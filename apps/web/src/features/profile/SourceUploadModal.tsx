import React, { useState, useRef, useEffect } from 'react';
import { useSession } from '../../app/session';
import { Button, Notice } from '../../components/Controls';
import { fetchWithHeaders } from '../../lib/api';
import type { InterpretationRunView, ProfileSourceView, InterpretationGrantView } from '@equipo10/contracts';
import styles from './SourceUploadModal.module.css';

interface SourceUploadModalProps {
  draftId: string;
  draftRevision: number;
  isOpen: boolean;
  onClose: () => void;
  onInterpretationReady: (runView: InterpretationRunView, sources: { id: string; version: number }[]) => void;
  initialText?: string;
  previousSources?: { id: string; version: number }[];
}

export function SourceUploadModal({
  draftId,
  draftRevision,
  isOpen,
  onClose,
  onInterpretationReady,
  initialText = "",
  previousSources = [],
}: SourceUploadModalProps) {
  const { session } = useSession();
  const [tab, setTab] = useState<'text' | 'file'>('text');
  const [manualText, setManualText] = useState(initialText);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const uploaded = useRef<{ input: string | File; source: ProfileSourceView } | null>(null);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const autoStarted = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const dialogHeading = useRef<HTMLHeadingElement>(null);

  const handleProcess = async () => {
    if (inFlight.current) return;
    if (!session?.access_token) {
      setError('Debes iniciar sesión para procesar fuentes.');
      return;
    }

    inFlight.current = true;
    setError(null);
    setStage("Leyendo tu fuente…");
    setLoading(true);

    try {
      let sourceView: ProfileSourceView;

      // 1. Cargar la fuente (texto o archivo)
      const sourceInput = tab === 'text' ? manualText.trim() : file;
      if (sourceInput && uploaded.current?.input === sourceInput) {
        sourceView = uploaded.current.source;
      } else if (tab === 'text') {
        if (!manualText.trim()) {
          setError('Por favor ingresa un texto o relato de tu experiencia.');
          return;
        }

        const sourceRes = await fetchWithHeaders<ProfileSourceView>(
          '/me/profile-sources',
          session.access_token,
          {
            method: 'POST',
            body: { kind: 'manual_text', text: manualText.trim() },
            headers: {
              'Idempotency-Key': `source-text-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
            },
          }
        );
        sourceView = sourceRes.data;
      } else {
        if (!file) {
          setError('Por favor selecciona un archivo PDF, imagen o audio.');
          return;
        }

        let kind = 'pdf';
        if (file.type.startsWith('image/')) kind = 'image';
        if (file.type.startsWith('audio/')) kind = 'audio';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('kind', kind);

        const sourceRes = await fetchWithHeaders<ProfileSourceView>(
          '/me/profile-sources',
          session.access_token,
          {
            method: 'POST',
            body: formData,
            headers: {
              'Idempotency-Key': `source-file-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
            },
          }
        );
        sourceView = sourceRes.data;
      }

      if (sourceInput) uploaded.current = { input: sourceInput, source: sourceView };

      // Si el PDF está escaneado, corrupto o no produjo texto digital utilizable
      if (sourceView.status === 'FAILED' || sourceView.fragments_count === 0) {
        setError(
          'El documento PDF no contiene texto digital utilizable (posiblemente sea un escaneo o esté protegido). Te ofrecemos ingresar los datos de tu trayectoria redactándola directamente en la pestaña "Escribir texto".'
        );
        setTab('text');
        return;
      }

      const sources = [...previousSources, { id: sourceView.id, version: sourceView.version }];
      setStage("Preparando la autorización de tus fuentes…");
      // 2. Crear autorización (InterpretationGrant)
      const grantRes = await fetchWithHeaders<InterpretationGrantView>(
        '/me/profile-interpretation-grants',
        session.access_token,
        {
          method: 'POST',
          body: {
            source_refs: sources,
            draft_revision: draftRevision,
            purpose: 'profile_interpretation',
            provider: 'vertex',
          },
          headers: {
            'Idempotency-Key': `grant-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          },
        }
      );

      setStage("Estamos leyendo tu información y preparando las preguntas…");
      // 3. Solicitar interpretación a A02
      const interpRes = await fetchWithHeaders<InterpretationRunView>(
        '/me/profile-interpretations',
        session.access_token,
        {
          method: 'POST',
          body: {
            draft_id: draftId,
            source_refs: sources,
            grant_id: grantRes.data.grant_id,
            goal: previousSources.length ? 'clarify_profile' : 'build_profile',
          },
          headers: {
            'If-Match': draftRevision.toString(),
            'Idempotency-Key': `interp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          },
        }
      );

      if (interpRes.data.status !== 'succeeded') {
        throw new Error('El análisis aún no tiene un resultado disponible. Tu borrador no se ha modificado.');
      }
      onInterpretationReady(interpRes.data, sources);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar la fuente con el asistente IA.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialText && previousSources.length && !autoStarted.current) {
      autoStarted.current = true;
      void handleProcess();
    }
  }, [isOpen, initialText]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogHeading.current?.focus();
    return () => previous?.focus();
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="source-dialog-title" ref={dialog}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !loading) onClose();
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
        if (!controls.length) { event.preventDefault(); dialogHeading.current?.focus(); return; }
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogHeading.current)) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div className={styles.modal} aria-busy={loading}>
        <header className={styles.header}>
          <h2 id="source-dialog-title" ref={dialogHeading} tabIndex={-1} className={styles.title}>{previousSources.length ? "Actualizando tus datos con tus respuestas" : "Cuéntanos tu trayectoria"}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {error && <Notice error>{error}</Notice>}

          {!previousSources.length && <div className={styles.tabGroup}>
            <button
              type="button"
              className={`${styles.tab} ${tab === 'text' ? styles.tabActive : ''}`}
              onClick={() => setTab('text')}
              disabled={loading}
            >
              Escribir o relatar
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === 'file' ? styles.tabActive : ''}`}
              onClick={() => setTab('file')}
              disabled={loading || previousSources.length > 0}
            >
              Cargar CV en PDF
            </button>
          </div>}

          {!previousSources.length && (tab === 'text' ? (
            <div>
              <label htmlFor="manual-text-input" style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Describe tus actividades laborales, voluntariados, cursos o intereses:
              </label>
              <textarea
                id="manual-text-input"
                className={styles.textarea}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Ejemplo: Trabajé como cajero en un comercio familiar atendiendo clientes y cuadrando caja. También hice un curso de computación básica..."
                maxLength={20000}
                disabled={loading}
              />
              <span className={styles.fileMeta}>
                {manualText.length} / 20,000 caracteres
              </span>
            </div>
          ) : (
            <div className={styles.fileInputWrapper}>
              <input
                id="file-upload-input"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={loading}
              />
              <span className={styles.fileMeta}>
                PDF con texto digital (máx. 10 MiB, 10 páginas). Imágenes, escaneos y audio todavía no disponibles.
              </span>
              {file && (
                <p style={{ margin: 0, fontWeight: 500 }}>
                  Archivo seleccionado: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          ))}

          <div className={styles.consentNotice}>
            <strong>Consentimiento de procesamiento:</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              Al pulsar el botón autorizas el envío de las fuentes seleccionadas y tus respuestas a Gemini mediante Vertex AI. El asistente solo generará propuestas que podrás revisar y decidir individualmente. Nada se añadirá a tu perfil sin tu confirmación.
            </p>
          </div>
        </div>

        <footer className={styles.footer}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleProcess} disabled={loading || (tab === 'text' ? !manualText.trim() : !file)} aria-busy={loading} aria-describedby={loading ? 'source-processing-status' : undefined}>
            {loading ? <><span className={styles.spinner} aria-hidden="true" />Revisión en curso…</> : previousSources.length ? 'Volver a intentar con mis respuestas' : 'Empezar la revisión'}
          </Button>
          {loading && <div id="source-processing-status" role="status" aria-live="polite" className={styles.processing}>
            <strong>{stage}</strong><p>Puede tardar hasta dos minutos. El botón está bloqueado para evitar envíos repetidos.</p>
          </div>}
        </footer>
      </div>
    </div>
  );
}
