import React, { useEffect, useRef, useState } from 'react';
import { AssessmentBankConfirmationSchema, type AssessmentBank, type AssessmentBankProposal, type AssessmentQuestion } from '@equipo10/contracts';
import { Button, Notice } from '../../components/Controls';
import { confirmAssessmentBank, listAssessmentBanks, proposeAssessmentBank } from './api';
import styles from './training-center.module.css';

export function TrainingQuestionBankPanel({ org, course, token, onBusyChange }: { org: string; course: string; token: string; onBusyChange?: (busy: boolean) => void }) {
  const [banks, setBanks] = useState<AssessmentBank[]>([]);
  const [proposal, setProposal] = useState<AssessmentBankProposal | null>(null);
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [tick, setTick] = useState(0);
  const [success, setSuccess] = useState('');
  const operation = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => { onBusyChange?.(Boolean(busy)); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  useEffect(() => {
    const abort = new AbortController(); setBusy('load'); setError('');
    listAssessmentBanks(org, course, token, abort.signal).then(response => setBanks(response.items)).catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'No pudimos consultar el banco.'); }).finally(() => { if (!abort.signal.aborted) setBusy(''); });
    return () => abort.abort();
  }, [org, course, token, tick]);
  async function generate() {
    if (busy || !consent) return;
    if (proposal && !window.confirm('¿Reemplazar la propuesta actual y sus cambios por nuevas preguntas?')) return;
    setBusy('generate'); setError(''); setSuccess('');
    try { setProposal(await proposeAssessmentBank(org, course, token)); setConfirmed(false); } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos generar preguntas. El curso publicado sigue intacto.'); } finally { setBusy(''); }
  }
  function update(id: string, patch: Partial<AssessmentQuestion>) {
    setProposal(prev => prev ? { ...prev, questions: prev.questions.map(q => q.id === id ? { ...q, ...patch } : q) } : prev); setConfirmed(false);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy || !proposal || !confirmed) return;
    const parsed = AssessmentBankConfirmationSchema.safeParse({ confirm: true, course_version_id: proposal.course_version_id, questions: proposal.questions });
    if (!parsed.success) { setError('Revisa cada pregunta, sus opciones, respuesta correcta, explicación y cita antes de confirmar.'); return; }
    const payload = JSON.stringify(parsed.data);
    if (operation.current?.payload !== payload) operation.current = { payload, key: crypto.randomUUID() };
    setBusy('save'); setError('');
    try { const bank = await confirmAssessmentBank(org, course, token, parsed.data, operation.current!.key); setBanks(prev => [bank, ...prev.filter(b => b.id !== bank.id)]); setProposal(null); setSuccess('Banco revisado guardado. El joven ya puede realizar el ejercicio.'); } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos guardar. Conservamos tu revisión para reintentar.'); } finally { setBusy(''); }
  }
  return <section className={styles.panel} aria-busy={Boolean(busy)}>
    <div className={styles.header}><div><h2>Preguntas para comprobar aprendizajes</h2><p className={styles.muted}>El asistente A02 usa el temario y las habilidades confirmadas. Revisa sus propuestas antes de habilitar el ejercicio.</p></div><Button variant="text" disabled={Boolean(busy)} onClick={() => setTick(t => t + 1)}>Actualizar bancos</Button></div>
    {error && <Notice error>{error}</Notice>}{success && <Notice>{success}</Notice>}
    {busy === 'load' ? <Notice>Cargando bancos revisados…</Notice> : banks.map(bank => <details key={bank.id}><summary>Banco revisado · {bank.questions.length} preguntas · {new Date(bank.created_at).toLocaleDateString('es-PA')}</summary><ol>{bank.questions.map(q => <li key={q.id}><strong>{q.prompt}</strong><p>Respuesta: {q.options.find(o => o.id === q.correct_option_id)?.text}</p><p>{q.rationale}</p><blockquote>«{q.quote}»</blockquote></li>)}</ol></details>)}
    <Notice>La evaluación es privada del joven. El centro no consulta sus respuestas. Un ejercicio no acredita todo el curso ni una habilidad completa.</Notice>
    <label className={styles.check}><input type="checkbox" checked={consent} disabled={Boolean(busy)} onChange={e => setConsent(e.target.checked)} />Autorizar el análisis del contenido confirmado mediante Vertex AI para proponer preguntas.</label>
    <div><Button variant="secondary" disabled={Boolean(busy) || !consent} onClick={generate}>{busy === 'generate' ? 'Preparando preguntas…' : proposal ? 'Generar otra propuesta' : 'Proponer preguntas con A02'}</Button></div>
    {proposal && <form className={styles.stack} onSubmit={save}><Notice>Estas preguntas todavía no están guardadas. Revisa y confirma el banco antes de salir.</Notice>{proposal.questions.map((q, index) => <fieldset className={styles.question} key={q.id} disabled={Boolean(busy)}><legend>Pregunta {index + 1}</legend>
      <label className={styles.field}>Enunciado<textarea required maxLength={1000} value={q.prompt} onChange={e => update(q.id, { prompt: e.target.value })} /></label>
      <p>Selecciona la única respuesta correcta y revisa las opciones:</p><div className={styles.options}>{q.options.map(option => <label className={styles.option} key={option.id}><input type="radio" name={`correct-${q.id}`} checked={q.correct_option_id === option.id} onChange={() => update(q.id, { correct_option_id: option.id })} aria-label={`Marcar como correcta la opción ${q.options.indexOf(option) + 1}`} /><input type="text" required maxLength={500} value={option.text} aria-label={`Pregunta ${index + 1}, opción ${q.options.indexOf(option) + 1}`} onChange={e => update(q.id, { options: q.options.map(o => o.id === option.id ? { ...o, text: e.target.value } : o) })} /></label>)}</div>
      <label className={styles.field}>Explicación de la respuesta<textarea required maxLength={1000} value={q.rationale} onChange={e => update(q.id, { rationale: e.target.value })} /></label><label className={styles.field}>Cita literal del temario<textarea required maxLength={1000} value={q.quote} onChange={e => update(q.id, { quote: e.target.value })} /></label>
    </fieldset>)}<label className={styles.check}><input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={e => setConfirmed(e.target.checked)} />He revisado las preguntas, sus respuestas, explicaciones y citas. Confirmar este banco para el ejercicio.</label><div><Button type="submit" disabled={Boolean(busy) || !confirmed}>{busy === 'save' ? 'Guardando banco revisado…' : 'Confirmar banco de preguntas'}</Button></div></form>}
  </section>;
}
