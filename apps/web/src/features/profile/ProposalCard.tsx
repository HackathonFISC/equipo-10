import { useState } from 'react';
import type { InterpretationSuggestion } from '@equipo10/contracts';
import { getProfileProposalIssues } from '@equipo10/contracts';
import { Button, Field, Notice } from '../../components/Controls';
import styles from './A02SuggestionsViewer.module.css';

export const sectionLabels: Record<string, string> = {
  EXPERIENCE: 'Experiencia', TRAINING: 'Estudios y cursos', INTERESTS: 'Intereses laborales', COMPETENCIES: 'Habilidades',
};
export function proposalTitle(suggestion: InterpretationSuggestion) {
  const value = suggestion.proposed_value as Record<string, unknown> | null;
  return String(value?.title || value?.name || value?.original_text || 'Dato encontrado');
}
export type ProposalChoice = 'accept' | 'reject' | 'defer';
export const canSaveSection = (section: string) => ['EXPERIENCE', 'TRAINING', 'INTERESTS'].includes(section);

export function ProposalCard({ suggestion, choice, replacement, onChoice, onEdit }: {
  suggestion: InterpretationSuggestion;
  choice: ProposalChoice;
  replacement?: Record<string, unknown>;
  onChoice: (choice: ProposalChoice) => void;
  onEdit: (value: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const value = replacement || (suggestion.proposed_value as Record<string, unknown>) || {};
  const titleKey = suggestion.section === 'EXPERIENCE' ? 'title' : suggestion.section === 'INTERESTS' ? 'original_text' : 'name';
  const issues = choice === 'accept' ? getProfileProposalIssues(suggestion.section, value) : [];
  const fieldError = (field: string) => issues.find((issue) => issue.field === field)?.message;
  return <article className={styles.suggestionCard}>
    <span className={styles.eyebrow}>{sectionLabels[suggestion.section] || 'Dato por revisar'}</span>
    <h3>{String(value[titleKey] || proposalTitle(suggestion))}</h3>
    {Boolean(value.organization_name || value.provider_name) && <p>{String(value.organization_name || value.provider_name)}</p>}
    {Boolean(value.description) && <p>{String(value.description)}</p>}
    {suggestion.section === 'EXPERIENCE' && <p className={styles.subtitle}>
      Período: {String(value.start_month || 'Inicio sin fecha exacta')} · {value.ongoing ? 'Hasta ahora' : String(value.end_month || 'Final sin fecha exacta')}
    </p>}
    <details className={styles.evidence}><summary>¿Por qué aparece este dato?</summary><p>{suggestion.rationale}</p></details>
    {canSaveSection(suggestion.section) ? <>
      {issues.length > 0 && <Notice error>{issues[0].message} Puedes corregirlo aquí o dejar este dato pendiente.</Notice>}
      <details className={styles.evidence} open={editing || issues.length > 0} onToggle={(event) => setEditing(event.currentTarget.open)}>
        <summary>Corregir este dato</summary>
        <Field id={'proposal-' + suggestion.suggestion_id} label={suggestion.section === 'EXPERIENCE' ? 'Actividad o puesto' : suggestion.section === 'TRAINING' ? 'Estudio o curso' : 'Área de interés'}
          value={String(value[titleKey] || '')} maxLength={suggestion.section === 'EXPERIENCE' ? 120 : 160} error={fieldError(titleKey)}
          onChange={(event) => onEdit({ ...value, [titleKey]: event.target.value })} />
        {suggestion.section !== 'INTERESTS' && <Field id={'entity-' + suggestion.suggestion_id} label={suggestion.section === 'EXPERIENCE' ? 'Dónde lo hiciste (opcional)' : 'Centro de formación (opcional)'}
          value={String(value[suggestion.section === 'EXPERIENCE' ? 'organization_name' : 'provider_name'] || '')} maxLength={160} error={fieldError(suggestion.section === 'EXPERIENCE' ? 'organization_name' : 'provider_name')}
          onChange={(event) => onEdit({ ...value, [suggestion.section === 'EXPERIENCE' ? 'organization_name' : 'provider_name']: event.target.value || null })} />}
        {suggestion.section === 'EXPERIENCE' && <>
          <label htmlFor={'kind-' + suggestion.suggestion_id}>Tipo de experiencia</label>
          <select id={'kind-' + suggestion.suggestion_id} value={String(value.kind || '')} aria-invalid={Boolean(fieldError('kind'))}
            onChange={(event) => onEdit({ ...value, kind: event.target.value })}>
            <option value="">Seleccionar tipo</option><option value="FORMAL">Empleo formal o pasantía</option>
            <option value="INFORMAL">Empleo informal o independiente</option><option value="VOLUNTEER">Voluntariado o servicio comunitario</option>
            <option value="PERSONAL_PROJECT">Proyecto personal o emprendimiento</option><option value="OTHER">Otra experiencia</option>
          </select>
          <Field id={'tasks-' + suggestion.suggestion_id} label="Qué hacías" required error={fieldError('description')}
            value={String(value.description || '')} maxLength={3000}
            onChange={(event) => onEdit({ ...value, description: event.target.value })} />
          <Field id={'start-' + suggestion.suggestion_id} label="Mes de inicio (opcional)" type="month" error={fieldError('start_month')}
            value={String(value.start_month || '')} onChange={(event) => onEdit({ ...value, start_month: event.target.value || null })} />
          <label><input type="checkbox" checked={value.ongoing === true} onChange={(event) => onEdit({ ...value, ongoing: event.target.checked, ...(event.target.checked ? { end_month: null } : {}) })} /> Continúo con esta actividad</label>
          <Field id={'end-' + suggestion.suggestion_id} label="Mes de fin (opcional)" type="month" disabled={value.ongoing === true} error={fieldError('end_month')}
            value={String(value.end_month || '')} onChange={(event) => onEdit({ ...value, end_month: event.target.value || null })} />
          <Button type="button" variant="text" onClick={() => onEdit({ ...value, start_month: null, end_month: null })}>Dejar fechas pendientes</Button>
        </>}
        {suggestion.section === 'TRAINING' && <>
          <Field id={'completed-' + suggestion.suggestion_id} label="Fecha de finalización (opcional)" type="date" error={fieldError('completed_on')}
            value={String(value.completed_on || '')} onChange={(event) => onEdit({ ...value, completed_on: event.target.value || null })} />
          <Button type="button" variant="text" onClick={() => onEdit({ ...value, completed_on: null })}>Dejar fecha pendiente</Button>
        </>}
        <p className={styles.subtitle}>Corregir no guarda todavía. Puedes completar fechas y añadir otras actividades después.</p>
      </details>
      <fieldset className={styles.choices}><legend>¿Lo añadimos a tu perfil?</legend>
        {([['accept', 'Sí, añadir'], ['reject', 'No corresponde'], ['defer', 'Dejar pendiente']] as const).map(([key, label]) =>
          <label key={key} className={styles.choice} data-selected={choice === key}>
            <input type="radio" name={'choice-' + suggestion.suggestion_id} checked={choice === key} onChange={() => onChoice(key)} />{label}
          </label>)}
      </fieldset>
    </> : <p>Esta habilidad queda como sugerencia para revisar. Todavía no se añadirá como habilidad acreditada ni se contará entre los datos guardados.</p>}
  </article>;
}
