import React from 'react';
import type { ProfileConstraintsValues, MobilityMode, MoneyPeriod } from '@equipo10/contracts';
import { Field } from '../../components/Controls';
import styles from './ExperienceStep.module.css';

interface ConstraintsEditorProps {
  constraints: ProfileConstraintsValues;
  onChangeConstraints: (constraints: ProfileConstraintsValues) => void;
  disabled?: boolean;
}

const MOBILITY_OPTIONS: { id: MobilityMode; label: string }[] = [
  { id: 'BUS', label: 'Metrobús / Rutas urbanas' },
  { id: 'METRO', label: 'Metro de Panamá' },
  { id: 'WALKING', label: 'A pie / caminata' },
  { id: 'BICYCLE', label: 'Bicicleta / micromovilidad' },
  { id: 'PRIVATE_VEHICLE', label: 'Auto propio o motocicleta' },
  { id: 'OTHER', label: 'Otro transporte' },
];

export function ConstraintsEditor({
  constraints,
  onChangeConstraints,
  disabled = false,
}: ConstraintsEditorProps) {
  const isLocationKnown = constraints.location_state === 'KNOWN';
  const isMobilityKnown = constraints.mobility_state === 'KNOWN';
  const isTravelLimitKnown = constraints.travel_limit_state === 'KNOWN';
  const isTeleworkOnly = isTravelLimitKnown && constraints.max_one_way_minutes === 0;
  const isSalaryKnown = constraints.salary_state === 'KNOWN';
  const isTransportKnown = constraints.transport_state === 'KNOWN';

  const handleToggleLocation = (known: boolean) => {
    onChangeConstraints({
      ...constraints,
      location_state: known ? 'KNOWN' : 'UNKNOWN',
      approximate_zone: known ? constraints.approximate_zone || 'Panamá Centro' : null,
    });
  };

  const handleZoneChange = (zone: string) => {
    onChangeConstraints({
      ...constraints,
      approximate_zone: zone,
      location_state: 'KNOWN',
    });
  };

  const handleToggleMobilityMode = (mode: MobilityMode) => {
    const currentModes = constraints.mobility_modes || [];
    const exists = currentModes.includes(mode);
    const updatedModes = exists
      ? currentModes.filter((m) => m !== mode)
      : [...currentModes, mode];

    onChangeConstraints({
      ...constraints,
      mobility_modes: updatedModes,
      mobility_state: updatedModes.length > 0 ? 'KNOWN' : 'UNKNOWN',
    });
  };

  const handleToggleTeleworkOnly = (telework: boolean) => {
    if (telework) {
      onChangeConstraints({
        ...constraints,
        travel_limit_state: 'KNOWN',
        max_one_way_minutes: 0,
      });
    } else {
      onChangeConstraints({
        ...constraints,
        travel_limit_state: 'KNOWN',
        max_one_way_minutes: 45,
      });
    }
  };

  const handleTravelLimitMinutes = (minutes: number) => {
    onChangeConstraints({
      ...constraints,
      travel_limit_state: 'KNOWN',
      max_one_way_minutes: minutes,
    });
  };

  const handleToggleNoTravelLimit = (noLimit: boolean) => {
    if (noLimit) {
      onChangeConstraints({
        ...constraints,
        travel_limit_state: 'UNKNOWN',
        max_one_way_minutes: null,
      });
    } else {
      onChangeConstraints({
        ...constraints,
        travel_limit_state: 'KNOWN',
        max_one_way_minutes: 45,
      });
    }
  };

  const handleToggleSalary = (known: boolean) => {
    onChangeConstraints({
      ...constraints,
      salary_state: known ? 'KNOWN' : 'UNKNOWN',
      minimum_salary: known ? constraints.minimum_salary || '650.00' : null,
      salary_currency: known ? 'USD' : null,
      salary_period: known ? 'MONTH' : null,
    });
  };

  const handleSalaryAmount = (val: string) => {
    onChangeConstraints({
      ...constraints,
      salary_state: 'KNOWN',
      minimum_salary: val,
      salary_currency: 'USD',
      salary_period: constraints.salary_period || 'MONTH',
    });
  };

  const handleSalaryPeriod = (period: MoneyPeriod) => {
    onChangeConstraints({
      ...constraints,
      salary_period: period,
    });
  };

  const handleToggleTransport = (known: boolean) => {
    onChangeConstraints({
      ...constraints,
      transport_state: known ? 'KNOWN' : 'UNKNOWN',
      transport_budget: known ? constraints.transport_budget || '50.00' : null,
      transport_currency: known ? 'USD' : null,
      transport_period: known ? 'MONTH' : null,
    });
  };

  const handleTransportAmount = (val: string) => {
    onChangeConstraints({
      ...constraints,
      transport_state: 'KNOWN',
      transport_budget: val,
      transport_currency: 'USD',
      transport_period: constraints.transport_period || 'MONTH',
    });
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Logística, movilidad y preferencias</h2>
          <p className={styles.sectionSubtitle}>
            Configura tu zona geográfica aproximada, traslados y expectativa mínima para conectar con opciones realistas.
          </p>
        </div>
      </div>

      {/* Zona Geográfica */}
      <div className={styles.itemsContainer}>
        <h3 className={styles.subFormTitle}>Zona de residencia aproximada</h3>
        <div className={styles.checkboxRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={!isLocationKnown}
              onChange={(e) => handleToggleLocation(!e.target.checked)}
              disabled={disabled}
              className={styles.checkbox}
            />
            <span>Prefiero no especificar mi zona por ahora</span>
          </label>
        </div>

        {isLocationKnown && (
          <div style={{ marginTop: '8px' }}>
            <Field
              id="approx-zone"
              label="Zona o corregimiento aproximado"
              value={constraints.approximate_zone || ''}
              onChange={(e) => handleZoneChange(e.target.value)}
              placeholder="Ej: Panamá Centro, San Miguelito, Arraiján..."
              help="Solo se usa para calcular distancias aproximadas; tu dirección exacta no se comparte."
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Modos de Movilidad */}
      <div className={styles.itemsContainer} style={{ marginTop: '20px' }}>
        <h3 className={styles.subFormTitle}>¿Cómo te movilizas usualmente?</h3>
        <p className={styles.sectionSubtitle}>
          Selecciona todos los medios de transporte que puedes utilizar.
        </p>

        <div className={styles.chipsRow}>
          {MOBILITY_OPTIONS.map((opt) => {
            const isSelected = (constraints.mobility_modes || []).includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleToggleMobilityMode(opt.id)}
                disabled={disabled}
                className={`${styles.chipButton} ${isSelected ? styles.chipSelected : ''}`.trim()}
              >
                {isSelected ? `✓ ${opt.label}` : `+ ${opt.label}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tiempo de Traslado */}
      <div className={styles.itemsContainer} style={{ marginTop: '20px' }}>
        <h3 className={styles.subFormTitle}>Límite de tiempo de viaje (ida)</h3>

        <div className={styles.checkboxRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isTeleworkOnly}
              onChange={(e) => handleToggleTeleworkOnly(e.target.checked)}
              disabled={disabled}
              className={styles.checkbox}
            />
            <span>Solo teletrabajo / 0 minutos de viaje requeridos</span>
          </label>
        </div>

        {!isTeleworkOnly && (
          <>
            <div className={styles.checkboxRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={!isTravelLimitKnown}
                  onChange={(e) => handleToggleNoTravelLimit(e.target.checked)}
                  disabled={disabled}
                  className={styles.checkbox}
                />
                <span>Sin límite de tiempo de viaje especificado</span>
              </label>
            </div>

            {isTravelLimitKnown && (
              <div style={{ marginTop: '8px' }}>
                <Field
                  id="travel-minutes"
                  type="number"
                  label="Máximo de minutos por trayecto de ida"
                  value={constraints.max_one_way_minutes ?? 45}
                  min={1}
                  max={180}
                  onChange={(e) => handleTravelLimitMinutes(parseInt(e.target.value, 10) || 0)}
                  help="Ej: 45 o 60 minutos para evitar trayectos desgastantes."
                  disabled={disabled}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Expectativa Salarial */}
      <div className={styles.itemsContainer} style={{ marginTop: '20px' }}>
        <h3 className={styles.subFormTitle}>Expectativa salarial mínima</h3>

        <div className={styles.checkboxRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={!isSalaryKnown}
              onChange={(e) => handleToggleSalary(!e.target.checked)}
              disabled={disabled}
              className={styles.checkbox}
            />
            <span>Aún no tengo un monto mínimo definido (abierto a ofertas)</span>
          </label>
        </div>

        {isSalaryKnown && (
          <div className={styles.datesGrid} style={{ marginTop: '8px' }}>
            <Field
              id="min-salary"
              type="number"
              step="0.01"
              label="Monto mínimo (USD)"
              value={constraints.minimum_salary || '650.00'}
              onChange={(e) => handleSalaryAmount(e.target.value)}
              placeholder="650.00"
              disabled={disabled}
            />

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Período</label>
              <select
                value={constraints.salary_period || 'MONTH'}
                onChange={(e) => handleSalaryPeriod(e.target.value as MoneyPeriod)}
                className={styles.selectInput}
                disabled={disabled}
              >
                <option value="MONTH">Mensual</option>
                <option value="BIWEEKLY">Quincenal</option>
                <option value="HOUR">Por hora</option>
                <option value="WEEK">Semanal</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Presupuesto Transporte */}
      <div className={styles.itemsContainer} style={{ marginTop: '20px' }}>
        <h3 className={styles.subFormTitle}>Presupuesto estimado de transporte</h3>

        <div className={styles.checkboxRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={!isTransportKnown}
              onChange={(e) => handleToggleTransport(!e.target.checked)}
              disabled={disabled}
              className={styles.checkbox}
            />
            <span>Sin estimación de presupuesto de transporte</span>
          </label>
        </div>

        {isTransportKnown && (
          <div style={{ marginTop: '8px' }}>
            <Field
              id="transport-budget"
              type="number"
              step="0.01"
              label="Presupuesto mensual para transporte (USD)"
              value={constraints.transport_budget || '50.00'}
              onChange={(e) => handleTransportAmount(e.target.value)}
              placeholder="50.00"
              help="Calcula cuánto estás dispuesto(a) a invertir al mes en pasajes o combustible."
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </section>
  );
}
