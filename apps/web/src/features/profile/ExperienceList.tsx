import React, { useState } from 'react';
import type { ExperienceItem, ExperienceKind } from '@equipo10/contracts';
import { Button, Field } from '../../components/Controls';
import styles from './ExperienceStep.module.css';

interface ExperienceListProps {
  items: ExperienceItem[];
  noneDeclared: boolean;
  onToggleNone: (none: boolean) => void;
  onChangeItems: (items: ExperienceItem[]) => void;
  disabled?: boolean;
}

const KIND_LABELS: Record<ExperienceKind, string> = {
  FORMAL: 'Empleo formal o pasantía',
  INFORMAL: 'Empleo informal o independiente',
  VOLUNTEER: 'Voluntariado o servicio comunitario',
  PERSONAL_PROJECT: 'Proyecto personal o emprendimiento',
  OTHER: 'Otra experiencia',
};

export function ExperienceList({
  items,
  noneDeclared,
  onToggleNone,
  onChangeItems,
  disabled = false,
}: ExperienceListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [kind, setKind] = useState<ExperienceKind>('INFORMAL');
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [description, setDescription] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [ongoing, setOngoing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setKind('INFORMAL');
    setTitle('');
    setOrganization('');
    setDescription('');
    setStartMonth('');
    setEndMonth('');
    setOngoing(false);
    setFormError(null);
    setIsAdding(false);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (!trimmedTitle) {
      setFormError('El título o rol de la experiencia es obligatorio.');
      return;
    }
    if (!trimmedDesc) {
      setFormError('La descripción de tareas o aprendizajes es obligatoria.');
      return;
    }

    if (startMonth && endMonth && !ongoing && endMonth < startMonth) {
      setFormError('El mes de fin no puede ser anterior al mes de inicio.');
      return;
    }

    const newItem: ExperienceItem = {
      kind,
      title: trimmedTitle,
      organization_name: organization.trim() || null,
      description: trimmedDesc,
      start_month: startMonth || null,
      end_month: ongoing ? null : endMonth || null,
      ongoing,
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
          <h2 className={styles.sectionTitle}>Experiencia laboral y actividades</h2>
          <p className={styles.sectionSubtitle}>
            Incluye cualquier trabajo que hayas realizado: familiar, independiente, voluntariado o formal.
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
          <span>No tengo experiencia laboral previa todavía</span>
        </label>
      </div>

      {!noneDeclared && (
        <div className={styles.itemsContainer}>
          {items.map((item, idx) => (
            <div key={item.id || idx} className={styles.itemCard}>
              <div className={styles.itemHeader}>
                <span className={styles.itemBadge}>{KIND_LABELS[item.kind] || item.kind}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  disabled={disabled}
                  className={styles.deleteButton}
                  title="Eliminar experiencia"
                  aria-label={`Eliminar ${item.title}`}
                >
                  ✕
                </button>
              </div>
              <h3 className={styles.itemTitle}>{item.title}</h3>
              {item.organization_name && (
                <p className={styles.itemOrg}>{item.organization_name}</p>
              )}
              <p className={styles.itemDesc}>{item.description}</p>
              <div className={styles.itemDates}>
                {item.start_month ? item.start_month : 'Inicio no especificado'} —{' '}
                {item.ongoing ? 'Actualmente en curso' : item.end_month || 'Fin no especificado'}
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
              + Agregar experiencia
            </Button>
          )}

          {isAdding && (
            <form onSubmit={handleAddItem} className={styles.subFormCard}>
              <h3 className={styles.subFormTitle}>Nueva experiencia</h3>

              {formError && <p className={styles.formErrorText}>{formError}</p>}

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Tipo de experiencia</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ExperienceKind)}
                  className={styles.selectInput}
                  disabled={disabled}
                >
                  <option value="INFORMAL">Empleo informal o independiente</option>
                  <option value="FORMAL">Empleo formal o pasantía</option>
                  <option value="VOLUNTEER">Voluntariado o servicio comunitario</option>
                  <option value="PERSONAL_PROJECT">Proyecto personal o emprendimiento</option>
                  <option value="OTHER">Otra experiencia</option>
                </select>
              </div>

              <Field
                id="exp-title"
                label="Puesto, rol o labor realizada"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Atención en tienda de abarrotes, Ayudante general..."
                required
                disabled={disabled}
              />

              <Field
                id="exp-org"
                label="Nombre del negocio, lugar o proyecto (opcional)"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Ej: Abarrotes San Miguel"
                disabled={disabled}
              />

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="exp-desc">
                  ¿Qué tareas hacías o qué aprendiste? *
                </label>
                <textarea
                  id="exp-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe brevemente tus funciones principales y aprendizajes..."
                  rows={3}
                  className={styles.textareaInput}
                  required
                  disabled={disabled}
                />
              </div>

              <div className={styles.datesGrid}>
                <Field
                  id="exp-start"
                  type="month"
                  label="Mes de inicio"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  disabled={disabled}
                />

                {!ongoing && (
                  <Field
                    id="exp-end"
                    type="month"
                    label="Mes de fin"
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                    disabled={disabled}
                  />
                )}
              </div>

              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={ongoing}
                    onChange={(e) => setOngoing(e.target.checked)}
                    disabled={disabled}
                    className={styles.checkbox}
                  />
                  <span>Continúo realizando esta actividad actualmente</span>
                </label>
              </div>

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
