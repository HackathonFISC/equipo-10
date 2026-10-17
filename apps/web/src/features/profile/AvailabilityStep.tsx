import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useDraft } from './useDraft';
import { Button, Notice, ProgressSteps } from '../../components/Controls';
import { TimeWindowEditor } from './TimeWindowEditor';
import { ConstraintsEditor } from './ConstraintsEditor';
import type { AvailabilityWindowView, ProfileConstraintsValues } from '@equipo10/contracts';
import styles from './AvailabilityStep.module.css';

interface AvailabilityStepProps {
  onContinue?: () => void;
  onBack?: () => void;
}

const DEFAULT_CONSTRAINTS: ProfileConstraintsValues = {
  location_state: 'UNKNOWN',
  approximate_zone: null,
  availability_state: 'UNKNOWN',
  mobility_state: 'UNKNOWN',
  mobility_modes: [],
  travel_limit_state: 'UNKNOWN',
  max_one_way_minutes: null,
  salary_state: 'UNKNOWN',
  minimum_salary: null,
  salary_currency: 'USD',
  salary_period: 'MONTH',
  transport_state: 'UNKNOWN',
  transport_budget: null,
  transport_currency: 'USD',
  transport_period: 'MONTH',
  training_state: 'UNKNOWN',
  training_budget: null,
  training_currency: 'USD',
  training_period: 'MONTH',
};

export function AvailabilityStep({ onContinue, onBack }: AvailabilityStepProps) {
  const navigate = useNavigate();
  const {
    draft,
    etag,
    loading,
    saving,
    conflict,
    error,
    saveAvailability,
    saveConstraints,
    reload,
  } = useDraft();

  const [windows, setWindows] = useState<AvailabilityWindowView[]>([]);
  const [constraints, setConstraints] = useState<ProfileConstraintsValues>(DEFAULT_CONSTRAINTS);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Sync draft state on load
  useEffect(() => {
    if (draft) {
      if (draft.windows) {
        setWindows(draft.windows);
      }
      if (draft.constraints) {
        setConstraints({
          ...DEFAULT_CONSTRAINTS,
          ...draft.constraints,
        });
      }
    }
  }, [draft]);

  const handleSaveAndContinue = async () => {
    setSuccessNotice(null);

    // 1. Guardar ventanas de disponibilidad
    const availSuccess = await saveAvailability({ windows });
    if (!availSuccess) return;

    // 2. Guardar restricciones y preferencias logísticas
    const constrSuccess = await saveConstraints(constraints);
    if (!constrSuccess) return;

    setSuccessNotice('Disponibilidad y restricciones guardadas correctamente.');

    if (onContinue) {
      onContinue();
    } else {
      navigate('/perfil/revision');
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/perfil/trayectoria');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.subtitle}>Cargando disponibilidad y preferencias...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ProgressSteps current={2} />

      <header className={styles.header}>
        <span className={styles.eyebrow}>Paso 3 de 4 · Disponibilidad y Logística</span>
        <h1 className={styles.title}>Tus tiempos, movilidad y expectativas.</h1>
        <p className={styles.subtitle}>
          Define tus franjas de disponibilidad semanal, zonas de viaje y aspiración de ingresos. El 0 es un límite válido (teletrabajo o sin presupuesto adicional).
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

      {error && !conflict && <Notice error>{error}</Notice>}
      {successNotice && <Notice>{successNotice}</Notice>}

      <div className={styles.contentGrid}>
        <div className={styles.formCard}>
          <TimeWindowEditor
            windows={windows}
            onChangeWindows={setWindows}
            disabled={saving || conflict}
          />

          <ConstraintsEditor
            constraints={constraints}
            onChangeConstraints={setConstraints}
            disabled={saving || conflict}
          />

          <div className={styles.actions}>
            <div className={styles.buttonGroup}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleBack}
                disabled={saving || conflict}
              >
                Volver a Trayectoria
              </Button>
              <Button
                type="button"
                onClick={handleSaveAndContinue}
                disabled={saving || conflict}
              >
                {saving ? 'Guardando...' : 'Guardar y continuar a Revisión'}
              </Button>
            </div>
            {etag && (
              <span className={styles.statusText}>
                Revisión activa: v{etag}
              </span>
            )}
          </div>
        </div>

        <aside className={styles.infoCard}>
          <h2 className={styles.infoTitle}>Logística realista</h2>
          <p className={styles.infoDesc}>
            Ajustar tu tiempo máximo de traslado y expectativas salariales evita emparejamientos inviables.
          </p>

          <div className={styles.infoHighlights}>
            <div className={styles.highlightItem}>
              <span className={styles.highlightIcon}>✓</span>
              <span>
                <strong>0 minutos de viaje</strong> significa exclusivamente teletrabajo o empleo en tu mismo barrio residencial.
              </span>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightIcon}>✓</span>
              <span>
                Tus horarios semanales permiten cuadrar turnos laborales y talleres que no choquen con tus clases o deberes familiares.
              </span>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightIcon}>✓</span>
              <span>
                Los presupuestos declarados son privados y solo sirven para guiar sugerencias de vacantes que cubran tus costos de transporte.
              </span>
            </div>
          </div>

          <span className={styles.infoMeta}>Sin descalificaciones arbitrarias · Control humano total</span>
        </aside>
      </div>
    </div>
  );
}
