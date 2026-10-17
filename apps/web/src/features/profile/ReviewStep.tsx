import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useDraft } from './useDraft';
import { useSession } from '../../app/session';
import { Button, Notice, ProgressSteps } from '../../components/Controls';
import { MissingFieldsNotice } from './MissingFieldsNotice';
import { fetchWithHeaders, ApiClientError } from '../../lib/api';
import type { ReviewPreviewResponse, ProfileConfirmationReceipt } from '@equipo10/contracts';
import styles from './ReviewStep.module.css';

export function ReviewStep() {
  const navigate = useNavigate();
  const { session, reload: reloadSession } = useSession();
  const token = session?.access_token;
  const { draft, etag, loading: draftLoading, conflict, reload } = useDraft();

  const [preview, setPreview] = useState<ReviewPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [acknowledgedPartial, setAcknowledgedPartial] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ProfileConfirmationReceipt | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Cargar preview al montar si hay sesión y etag
  const loadPreview = async () => {
    if (!token || !etag) return;

    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const idempotencyKey = `preview-${etag}-${Date.now()}`;
      const res = await fetchWithHeaders<ReviewPreviewResponse>(
        '/me/candidate-profile/draft/review-previews',
        token,
        {
          method: 'POST',
          headers: {
            'If-Match': etag,
            'Idempotency-Key': idempotencyKey,
          },
        }
      );
      setPreview(res.data);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setPreviewError(err.message);
      } else {
        setPreviewError('No se pudo generar la vista previa del perfil.');
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (token && etag && !preview && !loadingPreview && !receipt) {
      loadPreview();
    }
  }, [token, etag]);

  // Temporizador regresivo de 15 minutos
  useEffect(() => {
    if (!preview?.expires_at || receipt) return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(preview.expires_at).getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [preview?.expires_at, receipt]);

  const formatCountdown = (totalSeconds: number | null): string => {
    if (totalSeconds === null) return '--:--';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleConfirm = async () => {
    if (!token || !draft || !preview || !etag) {
      setConfirmError('No hay sesión o preview activo para confirmar.');
      return;
    }

    if (preview.acknowledge_partial_required && !acknowledgedPartial) {
      setConfirmError('Debes aceptar conscientemente que estás confirmando con campos opcionales pendientes.');
      return;
    }

    setConfirming(true);
    setConfirmError(null);

    try {
      const idempotencyKey = `confirm-${draft.id}-${etag}-${Date.now()}`;
      const res = await fetchWithHeaders<ProfileConfirmationReceipt>(
        '/me/candidate-profile/confirmations',
        token,
        {
          method: 'POST',
          headers: {
            'If-Match': etag,
            'Idempotency-Key': idempotencyKey,
          },
          body: {
            draft_id: draft.id,
            preview_id: preview.preview_id,
            acknowledge_partial: acknowledgedPartial,
          },
        }
      );
      setReceipt(res.data);
      reloadSession();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setConfirmError(err.message);
      } else {
        setConfirmError('Error de comunicación al confirmar el perfil.');
      }
    } finally {
      setConfirming(false);
    }
  };

  if (draftLoading || loadingPreview) {
    return (
      <div className={styles.container}>
        <p className={styles.subtitle}>Generando snapshot de revisión...</p>
      </div>
    );
  }

  // Vista de Recibo Confirmado (D2-A5)
  if (receipt) {
    return (
      <div className={styles.container}>
        <div className={styles.receiptCard}>
          <div className={styles.receiptBadge}>🎉</div>
          <h1 className={styles.receiptTitle}>¡Perfil confirmado exitosamente!</h1>
          <p className={styles.subtitle}>
            Tu perfil ha sido registrado como versión oficial inmutable en la base de datos.
          </p>

          <div className={styles.receiptDetails}>
            <p><strong>Versión oficial:</strong> Versión {receipt.version_number}</p>
            <p><strong>ID de confirmación:</strong> <code>{receipt.confirmation_id}</code></p>
            <p><strong>Recibo auditable:</strong> <code>{receipt.receipt_id}</code></p>
            <p><strong>Fecha de confirmación:</strong> {new Date(receipt.confirmed_at).toLocaleString()}</p>
            <p><strong>Hash de integridad (SHA-256):</strong></p>
            <p className={styles.digestText}>{receipt.snapshot_digest}</p>
          </div>

          <div style={{ marginTop: '16px' }}>
            <Button onClick={() => navigate('/inicio')}>
              Ir al Inicio y Explorar Oportunidades
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = remainingSeconds !== null && remainingSeconds === 0;

  return (
    <div className={styles.container}>
      <ProgressSteps current={3} />

      <header className={styles.header}>
        <span className={styles.eyebrow}>Paso 4 de 4 · Revisión y Confirmación</span>
        <h1 className={styles.title}>Revisa tu perfil antes de confirmar.</h1>
        <p className={styles.subtitle}>
          Verifica que la información sea exacta. Una vez confirmado, se creará una versión oficial inmutable para postular a oportunidades.
        </p>
      </header>

      {conflict && (
        <Notice error title="Conflicto de versión (HTTP 412)">
          El borrador cambió en otra pestaña o sesión.
          <div style={{ marginTop: '8px' }}>
            <Button variant="secondary" onClick={reload}>
              Recargar versión del servidor
            </Button>
          </div>
        </Notice>
      )}

      {previewError && <Notice error>{previewError}</Notice>}
      {confirmError && <Notice error>{confirmError}</Notice>}

      {preview && (
        <div className={styles.contentGrid}>
          <div className={styles.formCard}>
            <div className={styles.timerBanner}>
              <span>Snapshot temporal de revisión</span>
              <span>
                Vigencia:{' '}
                <span className={styles.timerCountdown}>
                  {isExpired ? 'EXPIRADO' : formatCountdown(remainingSeconds)}
                </span>
              </span>
            </div>

            {isExpired && (
              <Notice error>
                El snapshot de 15 minutos ha caducado. Genera una nueva vista previa para confirmar.
                <div style={{ marginTop: '8px' }}>
                  <Button variant="secondary" onClick={loadPreview}>
                    Actualizar vista previa
                  </Button>
                </div>
              </Notice>
            )}

            {/* Sección 1: Identidad */}
            <div className={styles.summarySection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>1. Identidad y Cuenta</h3>
                <Link to="/perfil/cuenta" className={styles.sectionLink}>Editar</Link>
              </div>
              <p className={styles.summaryValue}>
                <strong>Nombre:</strong> {preview.summary.display_name || 'Sin especificar'}
              </p>
              <p className={styles.summaryValue}>
                <strong>Titular:</strong> {preview.summary.headline || 'Sin especificar'}
              </p>
            </div>

            {/* Sección 2: Trayectoria e Intereses */}
            <div className={styles.summarySection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>2. Trayectoria e Intereses</h3>
                <Link to="/perfil/trayectoria" className={styles.sectionLink}>Editar</Link>
              </div>
              <p className={styles.summaryValue}>
                <strong>Experiencia:</strong>{' '}
                {preview.summary.experience_status === 'NONE'
                  ? 'Sin experiencia previa declarada'
                  : `${preview.summary.experiences_count} experiencia(s) registrada(s)`}
              </p>
              <p className={styles.summaryValue}>
                <strong>Formación:</strong>{' '}
                {preview.summary.training_status === 'NONE'
                  ? 'Sin formación previa declarada'
                  : `${preview.summary.trainings_count} curso(s) o estudio(s)`}
              </p>
              <p className={styles.summaryValue}>
                <strong>Intereses:</strong>{' '}
                {preview.summary.interests_status === 'NONE'
                  ? 'Sin intereses declarados'
                  : `${preview.summary.interests_count} puesto(s) de interés`}
              </p>
            </div>

            {/* Sección 3: Disponibilidad y Restricciones */}
            <div className={styles.summarySection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>3. Disponibilidad y Logística</h3>
                <Link to="/perfil/disponibilidad" className={styles.sectionLink}>Editar</Link>
              </div>
              <p className={styles.summaryValue}>
                <strong>Disponibilidad semanal:</strong> {preview.summary.availability_windows_count} ventana(s) horaria(s)
              </p>
              <p className={styles.summaryValue}>
                <strong>Zona aproximada:</strong> {preview.summary.approximate_zone || 'No indicada'}
              </p>
              <p className={styles.summaryValue}>
                <strong>Tiempo máximo de viaje:</strong>{' '}
                {preview.summary.max_one_way_minutes === 0
                  ? '0 minutos (Teletrabajo exclusivo / Mismo barrio)'
                  : preview.summary.max_one_way_minutes
                  ? `${preview.summary.max_one_way_minutes} minutos`
                  : 'Sin límite especificado'}
              </p>
              <p className={styles.summaryValue}>
                <strong>Pretensión salarial mínima:</strong>{' '}
                {preview.summary.minimum_salary ? `$${preview.summary.minimum_salary} USD / mes` : 'No especificada'}
              </p>
            </div>

            {/* Avisos de campos faltantes */}
            <MissingFieldsNotice missingFields={preview.missing_fields} />

            {/* Checkbox de aceptación consciente si faltan campos */}
            {preview.acknowledge_partial_required && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '14px',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  padding: '12px',
                  backgroundColor: 'var(--color-background)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <input
                  type="checkbox"
                  checked={acknowledgedPartial}
                  onChange={(e) => setAcknowledgedPartial(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Reconozco que algunas secciones opcionales no han sido completadas y confirmo mi perfil con los datos actuales.
                </span>
              </label>
            )}

            {/* Botones de acción */}
            <div className={styles.actions}>
              <div className={styles.buttonGroup}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/perfil/disponibilidad')}
                  disabled={confirming}
                >
                  Volver a Disponibilidad
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={
                    confirming ||
                    isExpired ||
                    (preview.acknowledge_partial_required && !acknowledgedPartial)
                  }
                >
                  {confirming ? 'Confirmando...' : 'Confirmar Perfil Oficial'}
                </Button>
              </div>
              <span className={styles.digestText}>
                Hash: {preview.snapshot_digest.slice(0, 16)}...
              </span>
            </div>
          </div>

          <aside className={styles.infoCard}>
            <h2 className={styles.infoTitle}>Confirmación transparente</h2>
            <p className={styles.infoDesc}>
              Al confirmar tu perfil se generará una versión inmutable (v1) auditable y criptográficamente sellada.
            </p>

            <div className={styles.infoHighlights}>
              <div className={styles.highlightItem}>
                <span className={styles.highlightIcon}>✓</span>
                <span>
                  Los reclutadores y centros solo verán información que hayas revisado y confirmado voluntariamente.
                </span>
              </div>
              <div className={styles.highlightItem}>
                <span className={styles.highlightIcon}>✓</span>
                <span>
                  Podrás actualizar tus datos en cualquier momento creando una nueva versión (v2) sin perder tu historial.
                </span>
              </div>
              <div className={styles.highlightItem}>
                <span className={styles.highlightIcon}>✓</span>
                <span>
                  Recibirás un comprobante de operación digital con sello de tiempo y resumen de datos.
                </span>
              </div>
            </div>

            <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
              Cero decisiones opacas · Privacidad por diseño
            </span>
          </aside>
        </div>
      )}
    </div>
  );
}
