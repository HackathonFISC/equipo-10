import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useDraft } from './useDraft';
import { useSession } from '../../app/session';
import { Button, Field, Notice, ProgressSteps } from '../../components/Controls';
import styles from './AccountStep.module.css';

interface AccountStepProps {
  onContinue?: () => void;
}

export function AccountStep({ onContinue }: AccountStepProps) {
  const navigate = useNavigate();
  const { me } = useSession();
  const { draft, etag, loading, saving, conflict, error, saveIdentity, reload } = useDraft();

  const dirty = useRef(false);
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Sync state when draft is loaded
  useEffect(() => {
    if (draft && !dirty.current) {
      setDisplayName(draft.display_name || '');
      setHeadline(draft.headline || '');
    }
  }, [draft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessNotice(null);

    const success = await saveIdentity({
      display_name: displayName.trim() || null,
      headline: headline.trim() || null,
    });

    if (success) {
      setSuccessNotice('Cambios guardados correctamente en tu borrador.');
      if (onContinue) {
        onContinue();
      } else {
        navigate('/perfil/trayectoria');
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.subtitle}>Cargando tu espacio...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ProgressSteps current={0} />

      <header className={styles.header}>
        <span className={styles.eyebrow}>Paso 1 de 4 · Cuenta</span>
        <h1 className={styles.title}>Empezar por lo esencial.</h1>
        <p className={styles.subtitle}>
          Crear tu cuenta es el primer paso. No necesitas un CV para comenzar.
        </p>
      </header>

      {conflict && (
        <Notice error title="Conflicto de versión (HTTP 412)">
          El borrador cambió en otra sesión o pestaña.
          <div style={{ marginTop: '8px' }}>
            <Button variant="secondary" onClick={() => { dirty.current = false; reload(); }}>
              Recargar versión del servidor
            </Button>
          </div>
        </Notice>
      )}

      {error && !conflict && <Notice error>{error}</Notice>}
      {successNotice && <Notice>{successNotice}</Notice>}

      <div className={styles.contentGrid}>
        <form onSubmit={handleSubmit} className={styles.formCard}>
          <Field
            id="display-name"
            label="Nombre para tu perfil"
            required
            maxLength={100}
            value={displayName}
            onChange={(e) => { dirty.current = true; setDisplayName(e.target.value); }}
            placeholder="Ej: Ana Demo"
            help="Nombre con el que te identificarás en la plataforma."
            disabled={saving || conflict}
          />

          <Field
            id="headline"
            label="Titular profesional o breve descripción"
            value={headline}
            onChange={(e) => { dirty.current = true; setHeadline(e.target.value); }}
            placeholder="Ej: Estudiante en búsqueda de oportunidades o Programador junior"
            help="Una frase corta que sintetice tu enfoque u objetivo actual."
            disabled={saving || conflict}
          />

          <Field
            id="email-account"
            label="Correo electrónico"
            value={me?.email || ''}
            readOnly
            className={styles.readOnlyInput}
            help="Tu correo de acceso está gestionado de forma privada."
          />

          <div className={styles.actions}>
            <Button type="submit" disabled={saving || conflict}>
              {saving ? 'Guardando...' : 'Continuar a mi experiencia'}
            </Button>
            {etag && (
              <span className={styles.statusText}>
                Revisión activa: v{etag}
              </span>
            )}
          </div>
        </form>

        <aside className={styles.infoCard}>
          <h2 className={styles.infoTitle}>Tu espacio empieza siendo privado</h2>
          <p className={styles.infoDesc}>
            Después podrás decidir qué datos compartir y con qué empresa. Crear una cuenta no
            envía tu perfil a nadie.
          </p>
          <span className={styles.infoMeta}>Tu información, bajo tu control</span>
        </aside>
      </div>
    </div>
  );
}
