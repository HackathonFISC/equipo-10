import React, { useEffect, useRef, useState } from 'react';
import { TrainingCompletionRequestSchema, type TrainingParticipantView, type TrainingCompletionRequest } from '@equipo10/contracts';
import { Button, Field, Notice } from '../../components/Controls';
import { listTrainingParticipants, recordTrainingCompletion } from './api';
import styles from './training-center.module.css';
import { TrainingCertificateAttachment } from './TrainingCertificateAttachment';

const message = (e: unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación. Puedes reintentar.';
const statusLabel = (status: string) => ({ CONFIRMED: 'Reserva confirmada', CANCELLED: 'Reserva cancelada', COMPLETED: 'Finalizado' }[status] ?? 'Reserva no disponible para finalizar');

export function TrainingParticipantsPanel({ org, token }: { org: string; token: string }) {
  const [items, setItems] = useState<TrainingParticipantView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [courseFilter, setCourseFilter] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError('');
    listTrainingParticipants(org, token, abort.signal).then(data => setItems(data.items)).catch(e => { if (!abort.signal.aborted) setError(message(e)); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [org, token, tick]);
  const courses = [...new Map(items.map(item => [item.course_id, item.course_title])).entries()];
  return <main className={styles.content} aria-busy={loading}>
    <header className={styles.header}><div><div className={styles.eyebrow}>CENTRO DE FORMACIÓN</div><h1>Acompañar cada aprendizaje.</h1><p className={styles.muted}>Consulta las reservas de tu centro y registra el resultado con respaldo humano.</p></div><Button variant="secondary" onClick={() => setTick(t => t + 1)} disabled={loading}>Actualizar lista</Button></header>
    <Notice>Registrar finalización no acredita habilidades automáticamente. El centro puede adjuntar un certificado existente, de acceso privado.</Notice>
    {error && <Notice error>{error}</Notice>}
    <label className={styles.field}>Filtrar por curso<select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}><option value="">Todos los cursos del centro</option>{courses.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
    {loading ? <Notice>Cargando participantes…</Notice> : items.length === 0 ? <Notice>Todavía no hay reservas en este centro.</Notice> : <div className={styles.stack}>{items.filter(item => !courseFilter || item.course_id === courseFilter).map(item => <ParticipantResult key={item.reservation_id} participant={item} org={org} token={token} onSaved={updated => setItems(prev => prev.map(row => row.reservation_id === updated.reservation_id ? updated : row))} />)}</div>}
  </main>;
}

function ParticipantResult({ participant, org, token, onSaved }: { participant: TrainingParticipantView; org: string; token: string; onSaved: (participant: TrainingParticipantView) => void }) {
  const [opened, setOpened] = useState(false);
  const [decision, setDecision] = useState<TrainingCompletionRequest['decision']>('COMPLETED');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const operation = useRef<{ payload: string; key: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy || !confirmed) return;
    const parsed = TrainingCompletionRequestSchema.safeParse({ decision, completed_on: date, reason, expected_status: 'CONFIRMED' });
    if (!parsed.success) { setError('Revisa la fecha (no futura) y escribe un motivo de al menos tres caracteres.'); return; }
    const payload = JSON.stringify(parsed.data);
    if (operation.current?.payload !== payload) operation.current = { payload, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const response = await recordTrainingCompletion(org, participant.reservation_id, token, parsed.data, operation.current!.key);
      onSaved({ ...participant, completion: response.completion }); setOpened(false);
      setSaved(response.isReplay ? 'El resultado ya estaba registrado. Recuperamos la confirmación sin duplicarlo.' : 'Resultado registrado correctamente.');
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <article className={styles.panel} aria-busy={busy}>
    <div className={styles.header}><div><h2>{participant.participant_name ?? `Participante ${participant.reservation_number}`}</h2><p>{participant.course_title}</p><p className={styles.muted}>Reserva {participant.reservation_number}</p></div><span className={styles.badge}>{statusLabel(participant.status)}</span></div>
    {saved && <Notice>{saved}</Notice>}
    {error && <Notice error>{error}</Notice>}
    {participant.completion ? <><h3>{participant.completion.decision === 'COMPLETED' ? 'Curso finalizado' : 'Curso no finalizado'}</h3><p>Fecha: {participant.completion.completed_on}</p><p>{participant.completion.reason}</p><TrainingCertificateAttachment completion={participant.completion} token={token} org={org} /></> : participant.status === 'CONFIRMED' ? <>
      {!opened ? <div><Button variant="secondary" onClick={() => setOpened(true)}>Registrar resultado</Button></div> : <form className={styles.stack} onSubmit={submit}>
        <div className={styles.grid}><label className={styles.field}>Resultado<select disabled={busy} value={decision} onChange={e => { setDecision(e.target.value as TrainingCompletionRequest['decision']); setConfirmed(false); }}><option value="COMPLETED">Finalizó el curso</option><option value="NOT_COMPLETED">No finalizó el curso</option></select></label><Field id={`completion-date-${participant.reservation_id}`} label="Fecha del resultado" required type="date" disabled={busy} value={date} onChange={e => { setDate(e.target.value); setConfirmed(false); }} help="Debe estar dentro del período del curso y no ser futura." /></div>
        <label className={styles.field}>Motivo o evidencia revisada<textarea required minLength={3} maxLength={1000} disabled={busy} value={reason} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
        <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />He verificado este resultado y confirmo su registro para esta persona. La corrección posterior requiere un proceso separado.</label>
        <div className={styles.actions}><Button type="submit" disabled={busy || !confirmed}>{busy ? 'Guardando resultado…' : 'Confirmar resultado'}</Button><Button type="button" variant="text" disabled={busy} onClick={() => setOpened(false)}>Volver sin guardar</Button></div>
      </form>}
    </> : <p className={styles.muted}>Esta reserva no admite registro de finalización.</p>}
  </article>;
}
