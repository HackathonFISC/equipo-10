import React, { useState } from 'react';
import type { TrainingItem } from '@equipo10/contracts';
import { Button, Field } from '../../components/Controls';
import styles from './ExperienceStep.module.css';

interface TrainingListProps {
  items: TrainingItem[];
  noneDeclared: boolean;
  onToggleNone: (none: boolean) => void;
  onChangeItems: (items: TrainingItem[]) => void;
  disabled?: boolean;
}

export function TrainingList({
  items,
  noneDeclared,
  onToggleNone,
  onChangeItems,
  disabled = false,
}: TrainingListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [completedOn, setCompletedOn] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const resetForm = () => {
    setName('');
    setProvider('');
    setCompletedOn('');
    setFormError(null);
    setIsAdding(false);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('El nombre del curso, taller o carrera es obligatorio.');
      return;
    }

    if (completedOn && completedOn > todayIso) {
      setFormError('La fecha de finalización no puede ser una fecha futura.');
      return;
    }

    const newItem: TrainingItem = {
      name: trimmedName,
      provider_name: provider.trim() || null,
      completed_on: completedOn || null,
    };

    onChangeItems([...items, newItem]);
    resetForm();
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    onChangeItems(updated);
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Cursos, talleres y educación</h2>
          <p className={styles.sectionSubtitle}>
            Capacitaciones, talleres técnicos, cursos en línea o estudios completados.
          </p>
        </div>
      </div>

      <div className={styles.checkboxRow}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={noneDeclared}
            onChange={(e) => onToggleNone(e.target.checked)}
            disabled={disabled}
            className={styles.checkbox}
          />
          <span>No tengo cursos o capacitaciones adicionales que declarar</span>
        </label>
      </div>

      {!noneDeclared && (
        <div className={styles.itemsContainer}>
          {items.map((item, idx) => (
            <div key={item.id || idx} className={styles.itemCard}>
              <div className={styles.itemHeader}>
                <span className={styles.itemBadge}>Formación</span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  disabled={disabled}
                  className={styles.deleteButton}
                  title="Eliminar curso"
                  aria-label={`Eliminar ${item.name}`}
                >
                  ✕
                </button>
              </div>
              <h3 className={styles.itemTitle}>{item.name}</h3>
              {item.provider_name && <p className={styles.itemOrg}>{item.provider_name}</p>}
              <div className={styles.itemDates}>
                {item.completed_on
                  ? `Completado el ${item.completed_on}`
                  : 'Fecha de culminación no especificada'}
              </div>
            </div>
          ))}

          {!isAdding && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAdding(true)}
              disabled={disabled}
            >
              + Agregar curso o capacitación
            </Button>
          )}

          {isAdding && (
            <form onSubmit={handleAddItem} className={styles.subFormCard}>
              <h3 className={styles.subFormTitle}>Nuevo curso o capacitación</h3>

              {formError && <p className={styles.formErrorText}>{formError}</p>}

              <Field
                id="train-name"
                label="Nombre del curso, taller o formación *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Manipulación de alimentos, Fundamentos de Excel, Inglés A2..."
                required
                disabled={disabled}
              />

              <Field
                id="train-provider"
                label="Institución o plataforma educativa (opcional)"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Ej: INADEH, Coursera, Universidad..."
                disabled={disabled}
              />

              <Field
                id="train-date"
                type="date"
                label="Fecha de culminación (opcional)"
                value={completedOn}
                max={todayIso}
                onChange={(e) => setCompletedOn(e.target.value)}
                disabled={disabled}
              />

              <div className={styles.subFormActions}>
                <Button type="submit" disabled={disabled}>
                  Guardar en lista
                </Button>
                <Button type="button" variant="text" onClick={resetForm} disabled={disabled}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
