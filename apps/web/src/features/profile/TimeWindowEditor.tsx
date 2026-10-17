import React, { useState } from 'react';
import type { AvailabilityWindowView } from '@equipo10/contracts';
import { Button } from '../../components/Controls';
import styles from './ExperienceStep.module.css';

interface TimeWindowEditorProps {
  windows: AvailabilityWindowView[];
  onChangeWindows: (windows: AvailabilityWindowView[]) => void;
  disabled?: boolean;
}

const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

export function TimeWindowEditor({
  windows,
  onChangeWindows,
  disabled = false,
}: TimeWindowEditorProps) {
  const [weekday, setWeekday] = useState<number>(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [formError, setFormError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const defaultValidFrom = `${currentYear}-01-01`;
  const defaultValidTo = `${currentYear + 1}-12-31`;

  const handleAddWindow = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const startMinute = timeStringToMinutes(startTime);
    const endMinute = timeStringToMinutes(endTime);

    if (startMinute >= endMinute) {
      setFormError('La hora de inicio debe ser anterior a la hora de fin.');
      return;
    }

    // Check overlap with existing windows on the same weekday
    const overlaps = windows.some((w) => {
      if (w.weekday !== weekday) return false;
      return startMinute < w.end_minute && endMinute > w.start_minute;
    });

    if (overlaps) {
      setFormError(
        `Ya existe una ventana horaria que se solapa para el ${WEEKDAY_NAMES[weekday]}.`
      );
      return;
    }

    const newWindow: AvailabilityWindowView = {
      weekday,
      start_minute: startMinute,
      end_minute: endMinute,
      timezone: 'America/Panama',
      valid_from: defaultValidFrom,
      valid_to: defaultValidTo,
    };

    onChangeWindows([...windows, newWindow]);
  };

  const handleApplyPreset = (type: 'FULL_WEEK' | 'MORNINGS' | 'AFTERNOONS' | 'WEEKENDS') => {
    setFormError(null);
    let newWindows: AvailabilityWindowView[] = [];

    if (type === 'FULL_WEEK') {
      // Lunes a Viernes 08:00 - 17:00
      newWindows = [1, 2, 3, 4, 5].map((d) => ({
        weekday: d,
        start_minute: 480, // 08:00
        end_minute: 1020,  // 17:00
        timezone: 'America/Panama',
        valid_from: defaultValidFrom,
        valid_to: defaultValidTo,
      }));
    } else if (type === 'MORNINGS') {
      // Lunes a Viernes 08:00 - 12:00
      newWindows = [1, 2, 3, 4, 5].map((d) => ({
        weekday: d,
        start_minute: 480,
        end_minute: 720,
        timezone: 'America/Panama',
        valid_from: defaultValidFrom,
        valid_to: defaultValidTo,
      }));
    } else if (type === 'AFTERNOONS') {
      // Lunes a Viernes 13:00 - 17:00
      newWindows = [1, 2, 3, 4, 5].map((d) => ({
        weekday: d,
        start_minute: 780, // 13:00
        end_minute: 1020, // 17:00
        timezone: 'America/Panama',
        valid_from: defaultValidFrom,
        valid_to: defaultValidTo,
      }));
    } else if (type === 'WEEKENDS') {
      // Sábado y Domingo 09:00 - 15:00
      newWindows = [6, 7].map((d) => ({
        weekday: d,
        start_minute: 540, // 09:00
        end_minute: 900,  // 15:00
        timezone: 'America/Panama',
        valid_from: defaultValidFrom,
        valid_to: defaultValidTo,
      }));
    }

    onChangeWindows(newWindows);
  };

  const handleRemoveWindow = (index: number) => {
    const updated = windows.filter((_, idx) => idx !== index);
    onChangeWindows(updated);
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Disponibilidad semanal</h2>
          <p className={styles.sectionSubtitle}>
            Indica los días y horarios en los que puedes trabajar o capacitarte.
          </p>
        </div>
      </div>

      <div className={styles.suggestionsContainer}>
        <span className={styles.suggestionsLabel}>Horarios predefinidos sugeridos:</span>
        <div className={styles.chipsRow}>
          <button
            type="button"
            onClick={() => handleApplyPreset('FULL_WEEK')}
            disabled={disabled}
            className={styles.chipButton}
          >
            L-V Completo (08:00 - 17:00)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('MORNINGS')}
            disabled={disabled}
            className={styles.chipButton}
          >
            L-V Mañanas (08:00 - 12:00)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('AFTERNOONS')}
            disabled={disabled}
            className={styles.chipButton}
          >
            L-V Tardes (13:00 - 17:00)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('WEEKENDS')}
            disabled={disabled}
            className={styles.chipButton}
          >
            Fines de semana (09:00 - 15:00)
          </button>
        </div>
      </div>

      {windows.length > 0 && (
        <div className={styles.itemsContainer} style={{ marginTop: '12px' }}>
          <span className={styles.fieldLabel}>Tus ventanas horarias configuradas:</span>
          {windows.map((win, idx) => (
            <div key={win.id || idx} className={styles.itemCard}>
              <div className={styles.itemHeader}>
                <span className={styles.itemBadge}>
                  {WEEKDAY_NAMES[win.weekday] || `Día ${win.weekday}`}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveWindow(idx)}
                  disabled={disabled}
                  className={styles.deleteButton}
                  title="Eliminar horario"
                  aria-label={`Eliminar horario de ${WEEKDAY_NAMES[win.weekday]}`}
                >
                  ✕
                </button>
              </div>
              <div className={styles.itemTitle}>
                {minutesToTimeString(win.start_minute)} — {minutesToTimeString(win.end_minute)}
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAddWindow} className={styles.subFormCard} style={{ marginTop: '12px' }}>
        <h3 className={styles.subFormTitle}>Agregar horario específico</h3>

        {formError && <p className={styles.formErrorText}>{formError}</p>}

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Día de la semana</label>
          <select
            value={weekday}
            onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
            className={styles.selectInput}
            disabled={disabled}
          >
            <option value={1}>Lunes</option>
            <option value={2}>Martes</option>
            <option value={3}>Miércoles</option>
            <option value={4}>Jueves</option>
            <option value={5}>Viernes</option>
            <option value={6}>Sábado</option>
            <option value={7}>Domingo</option>
          </select>
        </div>

        <div className={styles.datesGrid}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="start-time">
              Hora de inicio
            </label>
            <input
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={styles.selectInput}
              disabled={disabled}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="end-time">
              Hora de fin
            </label>
            <input
              id="end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={styles.selectInput}
              disabled={disabled}
            />
          </div>
        </div>

        <div className={styles.subFormActions}>
          <Button type="submit" disabled={disabled}>
            + Agregar a mi horario
          </Button>
        </div>
      </form>
    </section>
  );
}
