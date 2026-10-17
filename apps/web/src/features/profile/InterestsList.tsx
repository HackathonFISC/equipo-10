import React, { useState } from 'react';
import type { InterestItem } from '@equipo10/contracts';
import { Button, Field } from '../../components/Controls';
import styles from './ExperienceStep.module.css';

interface InterestsListProps {
  items: InterestItem[];
  noneDeclared: boolean;
  onToggleNone: (none: boolean) => void;
  onChangeItems: (items: InterestItem[]) => void;
  disabled?: boolean;
}

const COMMON_SUGGESTIONS = [
  'Atención al cliente',
  'Logística y almacén',
  'Desarrollo web y programación',
  'Soporte técnico y redes',
  'Ventas y comercio',
  'Asistencia administrativa',
  'Cocina y gastronomía',
  'Operaciones de planta',
];

export function InterestsList({
  items,
  noneDeclared,
  onToggleNone,
  onChangeItems,
  disabled = false,
}: InterestsListProps) {
  const [inputText, setInputText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (items.some((i) => i.original_text.toLowerCase() === trimmed.toLowerCase())) {
      setFormError('Ese interés ya se encuentra en tu lista.');
      return;
    }

    setFormError(null);
    onChangeItems([...items, { original_text: trimmed }]);
    setInputText('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddText(inputText);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    onChangeItems(updated);
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Áreas y roles de tu interés</h2>
          <p className={styles.sectionSubtitle}>
            ¿En qué tipo de actividades o puestos te gustaría trabajar o aprender?
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
          <span>No tengo áreas de interés definidas en este momento</span>
        </label>
      </div>

      {!noneDeclared && (
        <div className={styles.itemsContainer}>
          <form onSubmit={handleFormSubmit} className={styles.interestInputRow}>
            <div style={{ flex: 1 }}>
              <Field
                id="interest-text"
                label="Escribe un área, puesto o sector"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ej: Auxiliar de bodega, Programador júnior..."
                disabled={disabled}
              />
            </div>
            <div style={{ alignSelf: 'flex-end', marginBottom: '8px' }}>
              <Button type="submit" disabled={disabled || !inputText.trim()}>
                Agregar
              </Button>
            </div>
          </form>

          {formError && <p className={styles.formErrorText}>{formError}</p>}

          <div className={styles.suggestionsContainer}>
            <span className={styles.suggestionsLabel}>Sugerencias rápidas:</span>
            <div className={styles.chipsRow}>
              {COMMON_SUGGESTIONS.map((sug) => {
                const isSelected = items.some(
                  (i) => i.original_text.toLowerCase() === sug.toLowerCase()
                );
                return (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleAddText(sug)}
                    disabled={disabled || isSelected}
                    className={`${styles.chipButton} ${isSelected ? styles.chipSelected : ''}`.trim()}
                  >
                    {isSelected ? `✓ ${sug}` : `+ ${sug}`}
                  </button>
                );
              })}
            </div>
          </div>

          {items.length > 0 && (
            <div className={styles.selectedInterestsList}>
              <span className={styles.fieldLabel}>Tus intereses seleccionados:</span>
              <div className={styles.chipsRow}>
                {items.map((item, idx) => (
                  <div key={item.id || idx} className={styles.activeInterestChip}>
                    <span>{item.original_text}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={disabled}
                      className={styles.chipRemoveButton}
                      title={`Quitar ${item.original_text}`}
                      aria-label={`Quitar ${item.original_text}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
