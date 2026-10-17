import React, { useEffect, useRef, useState } from 'react';
import { AssessmentSubmissionSchema, type AssessmentAttemptPublic } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { ApiClientError } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import { associateTrainingAssessment, getAvailableAssessment, getTrainingAssessment, listTrainingAssessments, startTrainingAssessment, submitTrainingAssessment } from './api';
import styles from './training-center.module.css';

const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación. Puedes reintentar.';
function operationKey(ref: React.RefObject<{ payload: string; key: string } | null>, value: unknown) {
  const payload = JSON.stringify(value);
  if (ref.current?.payload !== payload) ref.current = { payload, key: crypto.randomUUID() };
  return ref.current!.key;
}
export function TrainingAssessmentPanel({ courseId }: { courseId: string }) {
  const { session, me } = useSession();
  const [bank, setBank] = useState<{ id: string; question_count: number } | null>(null);
  const [attempt, setAttempt] = useState<AssessmentAttemptPublic | null>(null);
  const [history, setHistory] = useState<AssessmentAttemptPublic[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [associateConsent, setAssociateConsent] = useState(false);
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const startKey = useRef<{ payload: string; key: string } | null>(null);
  const submitKey = useRef<{ payload: string; key: string } | null>(null);
  const associateKey = useRef<{ payload: string; key: string } | null>(null);
  const storageKey = `training-assessment:${me?.user.id ?? ''}:${courseId}`;
  const token = session?.access_token;
  useEffect(() => {
    if (!token || !me) return;
    const abort = new AbortController();
    setBusy('load'); setError(''); setBank(null); setAttempt(null); setAnswers({}); setHistory([]);
    async function load() {
      let saved: string | null = null;
      try { saved = sessionStorage.getItem(storageKey); } catch { /* Recovery remains optional when storage is unavailable. */ }
      const response = await listTrainingAssessments(courseId, token!, abort.signal);
      if (abort.signal.aborted) return;
      setHistory(response.items);
      const existing = response.items.find(item => item.id === saved) ?? response.items.find(item => item.status === 'STARTED') ?? response.items[0];
      if (existing) {
        setAttempt(existing);
        try { setAnswers(JSON.parse(sessionStorage.getItem(`${storageKey}:answers:${existing.id}`) ?? '{}')); } catch { setAnswers({}); }
        return;
      }
      try { const available = await getAvailableAssessment(courseId, token!, abort.signal); if (!abort.signal.aborted) setBank(available); }
      catch (e) { if (!(e instanceof ApiClientError && e.status === 404)) throw e; }
    }
    load().catch(e => { if (!abort.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!abort.signal.aborted) setBusy(''); });
    return () => abort.abort();
  }, [token, me?.user.id, courseId, storageKey, tick]);
  useEffect(() => { if (attempt?.status !== 'STARTED') return; try { sessionStorage.setItem(`${storageKey}:answers:${attempt.id}`, JSON.stringify(answers)); } catch { /* Server attempt remains available. */ } }, [answers, attempt?.status, attempt?.id, storageKey]);
  async function start() {
    if (!token || !bank || busy || !consent) return;
    setBusy('start'); setError('');
    try { const created = await startTrainingAssessment(courseId, token, bank.id, operationKey(startKey, bank.id)); setAttempt(created); setHistory(prev => [created, ...prev.filter(item => item.id !== created.id)]); try { sessionStorage.setItem(storageKey, created.id); } catch { /* Current attempt remains usable. */ } } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function openAttempt(id: string) {
    if (!token || busy || id === attempt?.id) return;
    setBusy('open'); setError('');
    try { const selected = await getTrainingAssessment(id, token); setAttempt(selected); setHistory(prev => prev.map(item => item.id === selected.id ? selected : item)); setConfirmed(false); setAssociateConsent(false); try { setAnswers(JSON.parse(sessionStorage.getItem(`${storageKey}:answers:${selected.id}`) ?? '{}')); sessionStorage.setItem(storageKey, selected.id); } catch { setAnswers({}); } } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!attempt || !token || busy || !confirmed) return;
    const body = { confirm: true as const, answers: attempt.questions.map(q => ({ question_id: q.id, option_id: answers[q.id] ?? '' })) };
    const parsed = AssessmentSubmissionSchema.safeParse(body);
    if (!parsed.success) { setError('Selecciona una respuesta para cada pregunta antes de entregar.'); return; }
    setBusy('submit'); setError('');
    try { const submitted = await submitTrainingAssessment(attempt.id, token, parsed.data, operationKey(submitKey, parsed.data)); setAttempt(submitted); setHistory(prev => prev.map(item => item.id === submitted.id ? submitted : item)); } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  async function associate() {
    if (!attempt || !token || busy || !associateConsent) return;
    setBusy('associate'); setError('');
    try { await associateTrainingAssessment(attempt.id, token, operationKey(associateKey, attempt.id)); setAttempt(prev => prev ? { ...prev, association_confirmed: true } : prev); setHistory(prev => prev.map(item => item.id === attempt.id ? { ...item, association_confirmed: true } : item)); } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); }
  }
  if (!session) return null;
  return <section className={styles.panel} aria-busy={Boolean(busy)}>
    <div className={styles.header}><div><h2>Comprueba lo que sabes</h2><p className={styles.muted}>Ejercicio privado con preguntas revisadas por el centro.</p></div><Button variant="text" disabled={Boolean(busy)} onClick={() => setTick(t => t + 1)}>Actualizar ejercicio</Button></div>
    <Notice>El resultado describe únicamente este ejercicio. No equivale a completar el curso, obtener un certificado ni acreditar toda una habilidad. Tus respuestas no se muestran al centro.</Notice>
    {error && <Notice error>{error}</Notice>}
    {history.length > 0 && <label className={styles.field}>Mis intentos guardados<select disabled={Boolean(busy)} value={attempt?.id ?? ''} onChange={e => openAttempt(e.target.value)}>{history.map((item, index) => <option key={item.id} value={item.id}>Intento {history.length - index} · {item.status === 'SUBMITTED' ? 'Entregado' : 'En curso'}{item.association_confirmed ? ' · Asociado al perfil' : ''}</option>)}</select></label>}
    {busy === 'load' ? <Notice>Cargando ejercicio…</Notice> : !attempt && !bank ? <p className={styles.muted}>Este curso todavía no tiene un ejercicio revisado disponible.</p> : !attempt && bank ? <><p>{bank.question_count} preguntas de opción única.</p><label className={styles.check}><input type="checkbox" checked={consent} disabled={Boolean(busy)} onChange={e => setConsent(e.target.checked)} />Acepto iniciar el ejercicio y guardar mis respuestas y resultado de forma privada.</label><div><Button disabled={Boolean(busy) || !consent} onClick={start}>{busy === 'start' ? 'Iniciando ejercicio…' : 'Iniciar ejercicio'}</Button></div></> : null}
    {attempt?.status === 'STARTED' && <form className={styles.stack} onSubmit={submit}>{attempt.questions.map((q, i) => <fieldset className={styles.question} key={q.id} disabled={Boolean(busy)}><legend>Pregunta {i + 1} de {attempt.questions.length}</legend><p>{q.prompt}</p><div className={styles.options}>{q.options.map(option => <label className={styles.option} key={option.id}><input required type="radio" name={`answer-${q.id}`} checked={answers[q.id] === option.id} onChange={() => { setAnswers(prev => ({ ...prev, [q.id]: option.id })); setConfirmed(false); }} />{option.text}</label>)}</div></fieldset>)}<label className={styles.check}><input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={e => setConfirmed(e.target.checked)} />Revisé mis respuestas y confirmo su entrega.</label><div><Button type="submit" disabled={Boolean(busy) || !confirmed || attempt.questions.some(q => !answers[q.id])}>{busy === 'submit' ? 'Evaluando respuestas…' : 'Entregar respuestas'}</Button></div></form>}
    {attempt?.status === 'SUBMITTED' && attempt.result && <div className={styles.stack}><h3>Resultado: {attempt.result.correct_count} de {attempt.result.total_count} respuestas correctas</h3>{attempt.questions.map((q, i) => { const result = attempt.result!.items.find(item => item.question_id === q.id); return <article className={styles.proposal} key={q.id}><h3>{i + 1}. {q.prompt}</h3><p>{result?.correct ? 'Respuesta correcta' : 'Por repasar'}</p><p>{result?.feedback}</p></article>; })}
      {attempt.association_confirmed ? <Notice title="Resultado asociado a tu perfil">Se guardó como evidencia limitada a este ejercicio. No acredita automáticamente una habilidad completa.</Notice> : <><label className={styles.check}><input type="checkbox" checked={associateConsent} disabled={Boolean(busy)} onChange={e => setAssociateConsent(e.target.checked)} />Quiero asociar este resultado a mi perfil como evidencia de este ejercicio.</label><div><Button variant="secondary" disabled={Boolean(busy) || !associateConsent} onClick={associate}>{busy === 'associate' ? 'Asociando resultado…' : 'Confirmar asociación al perfil'}</Button></div></>}
    </div>}
  </section>;
}
