import React, { useEffect, useRef, useState } from 'react';
import { TrainingCourseDraftSchema, TrainingCoursePublicationSchema, TrainingCourseWorkspaceSchema, SyllabusInterpretRequestSchema, type SyllabusInterpretation, type TrainingCourseSummary } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { Button, Field, Notice } from '../../components/Controls';
import { createTrainingCourse, getTrainingCourse, interpretTrainingCourse, listTrainingCourses, publishTrainingCourse, saveTrainingWorkspace, type TrainingCourseDetail, type PublicationReceipt } from './api';
import styles from './training-center.module.css';
import { TrainingParticipantsPanel } from './TrainingParticipantsPanel';
import { TrainingQuestionBankPanel } from './TrainingQuestionBankPanel';

const message = (e: unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación. Conservamos tus datos para reintentar.';
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
function stableKey(ref: React.RefObject<{ payload: string; key: string } | null>, body: unknown) {
  const payload = JSON.stringify(body);
  if (ref.current?.payload !== payload) ref.current = { payload, key: crypto.randomUUID() };
  return ref.current!.key;
}

export function TrainingCenterPage() {
  const { me, session } = useSession();
  const contexts = me?.contexts.filter(c => c.organization.type === 'TRAINING_CENTER' && (c.role === 'TRAINING_MANAGER' || c.role === 'ADMIN')) ?? [];
  const [selected, setSelected] = useState('');
  const [section, setSection] = useState<'courses' | 'participants'>('courses');
  const [navigationBusy, setNavigationBusy] = useState(false);
  const org = contexts.find(c => c.organization.id === selected) ?? contexts[0];
  if (!org || !session) return <Notice title="Gestión de centros">Necesitas una cuenta invitada con permisos en un centro de formación. Cambiar de perfil visual no concede acceso.</Notice>;
  return <div className={styles.layout}>
    <aside className={styles.sidebar} aria-label="Centro de formación">
      <span className={styles.eyebrow}>TU CENTRO</span>
      {contexts.length > 1 ? <label className={styles.field}>Organización<select disabled={navigationBusy} value={org.organization.id} onChange={e => setSelected(e.target.value)}>{contexts.map(c => <option key={c.organization.id} value={c.organization.id}>{c.organization.name}</option>)}</select></label> : <h2>{org.organization.name}</h2>}
      <Button disabled={navigationBusy} aria-pressed={section === 'courses'} variant={section === 'courses' ? 'primary' : 'text'} onClick={() => setSection('courses')}>Cursos y ediciones</Button>
      <Button disabled={navigationBusy} aria-pressed={section === 'participants'} variant={section === 'participants' ? 'primary' : 'text'} onClick={() => setSection('participants')}>Participantes</Button>
      <p>Gestiona los certificados privados desde el resultado de cada participante.</p>
    </aside>
    {section === 'courses' ? <CenterCourses key={org.organization.id} org={org.organization.id} token={session.access_token} onBusyChange={setNavigationBusy} /> : <TrainingParticipantsPanel key={org.organization.id} org={org.organization.id} token={session.access_token} />}
  </div>;
}

function CenterCourses({ org, token, onBusyChange }: { org: string; token: string; onBusyChange: (busy: boolean) => void }) {
  const [items, setItems] = useState<TrainingCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [course, setCourse] = useState<TrainingCourseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', title: '', description: '' });
  const createKey = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    listTrainingCourses(org, token, controller.signal).then(res => setItems(res.items)).catch(e => { if (!controller.signal.aborted) setError(message(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [org, token, tick]);
  async function open(id: string) {
    if (busy) return;
    setBusy(true); setError('');
    try { setCourse(await getTrainingCourse(org, id, token)); setCreating(false); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    const parsed = TrainingCourseDraftSchema.safeParse(form);
    if (!parsed.success) { setError('Completa título, descripción y un código de hasta 50 letras, números, guiones o guiones bajos.'); return; }
    setBusy(true); setError('');
    try {
      const created = await createTrainingCourse(org, token, parsed.data, stableKey(createKey, parsed.data));
      setCourse(await getTrainingCourse(org, created.id, token)); setCreating(false); setForm({ code: '', title: '', description: '' }); setTick(t => t + 1);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  if (course) return <CourseEditor key={course.id} initial={course} org={org} token={token} onBusyChange={onBusyChange} onClose={() => { setCourse(null); setTick(t => t + 1); }} />;
  return <main className={styles.content} aria-busy={busy || loading}>
    <header className={styles.header}><div><div className={styles.eyebrow}>CENTRO DE FORMACIÓN</div><h1>Cada curso, en buenas manos.</h1><p className={styles.muted}>Conecta lo que enseñas con habilidades concretas y oportunidades reales.</p></div><Button disabled={busy} onClick={() => setCreating(v => !v)}>{creating ? 'Cerrar formulario' : '+ Crear curso'}</Button></header>
    {error && <Notice error>{error}</Notice>}
    {creating && <form className={styles.panel} onSubmit={create}><h2>Empezar un curso</h2><div className={styles.grid}><Field id="course-code" label="Código interno" required maxLength={50} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /><Field id="course-title" label="Nombre del curso" required maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div><label className={styles.field}>Descripción<textarea required maxLength={3000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><div><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Crear borrador'}</Button></div></form>}
    {loading ? <Notice>Cargando cursos…</Notice> : <><div className={styles.header}><h2>Tus cursos</h2><Button variant="text" disabled={busy} onClick={() => setTick(t => t + 1)}>Actualizar lista</Button></div>{items.length === 0 ? <Notice>No hay cursos todavía. Crea el primero para revisar su temario y publicar una edición.</Notice> : <div className={styles.cards}>{items.map(item => <article className={styles.card} key={item.id}><div><span className={styles.badge}>{item.active ? 'Publicado' : 'Borrador'}</span></div><h2>{item.title}</h2><p className={styles.muted}>{item.description}</p><p>Código: {item.code}</p><Button variant="secondary" disabled={busy} onClick={() => open(item.id)}>{busy ? 'Abriendo…' : 'Ver curso y ediciones'}</Button></article>)}</div>}</>}
  </main>;
}

function CourseEditor({ initial, org, token, onClose, onBusyChange }: { initial: TrainingCourseDetail; org: string; token: string; onClose: () => void; onBusyChange: (busy: boolean) => void }) {
  const [course, setCourse] = useState(initial);
  const storageKey = `training-syllabus:${org}:${course.id}`;
  const [text, setText] = useState(() => { if (initial.workspace) return initial.workspace.syllabus_text; try { return sessionStorage.getItem(storageKey) ?? initial.versions[0]?.syllabus_text ?? ''; } catch { return initial.versions[0]?.syllabus_text ?? ''; } });
  const [answers, setAnswers] = useState<string[]>([]);
  const [answerHistory, setAnswerHistory] = useState<string[]>(initial.workspace?.answers ?? []);
  const [result, setResult] = useState<SyllabusInterpretation | null>(initial.workspace?.interpretation ?? null);
  const [chosen, setChosen] = useState<boolean[]>(initial.workspace?.chosen ?? []);
  const [busy, setBusy] = useState('');
  const [bankBusy, setBankBusy] = useState(false);
  const [error, setError] = useState('');
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [savedWorkspace, setSavedWorkspace] = useState(() => JSON.stringify({ syllabus_text: initial.workspace?.syllabus_text ?? '', answers: initial.workspace?.answers ?? [], interpretation: initial.workspace?.interpretation ?? null, chosen: initial.workspace?.chosen ?? [] }));
  const [receipt, setReceipt] = useState<PublicationReceipt | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [consent, setConsent] = useState(false);
  const [edition, setEdition] = useState({ modality: 'REMOTE' as 'REMOTE' | 'ON_SITE' | 'HYBRID', location: '', start_date: '', end_date: '', total_slots: '20', cost_amount: '0', cost_currency: 'USD' });
  const [sessions, setSessions] = useState([{ weekday: 1, start: '09:00', end: '11:00' }]);
  const publicationKey = useRef<{ payload: string; key: string } | null>(null);
  const workspaceKey = useRef<{ payload: string; key: string } | null>(null);
  const pendingAnswers = answers.flatMap((answer, i) => answer?.trim() ? [`${result?.questions[i] ?? 'Aclaración'}\nRespuesta: ${answer.trim()}`] : []);
  const workspaceData = { syllabus_text: text, answers: [...answerHistory, ...pendingAnswers], interpretation: pendingAnswers.length ? null : result, chosen: pendingAnswers.length ? [] : chosen };
  const workspaceDirty = JSON.stringify(workspaceData) !== savedWorkspace;
  useEffect(() => { onBusyChange(Boolean(busy) || bankBusy); return () => onBusyChange(false); }, [busy, bankBusy, onBusyChange]);
  useEffect(() => { try { sessionStorage.setItem(storageKey, text); } catch { /* The form remains usable without browser storage. */ } }, [storageKey, text]);
  useEffect(() => {
    if (!workspaceDirty || course.active) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [workspaceDirty, course.active]);
  async function saveWorkspace() {
    if (busy || course.active) return;
    const parsed = TrainingCourseWorkspaceSchema.safeParse({ expected_updated_at: course.updated_at, ...workspaceData });
    if (!parsed.success) { setError('Revisa el temario y las aclaraciones antes de guardar el avance. Debe haber un máximo de tres respuestas y las propuestas deben citar el temario actual.'); return; }
    setBusy('workspace'); setError(''); setWorkspaceMessage('');
    try {
      const response = await saveTrainingWorkspace(org, course.id, token, parsed.data, stableKey(workspaceKey, parsed.data));
      setCourse(prev => ({ ...prev, updated_at: response.updated_at, workspace: response.workspace }));
      setText(response.workspace.syllabus_text); setAnswerHistory(response.workspace.answers); setAnswers([]);
      setResult(response.workspace.interpretation); setChosen(response.workspace.chosen); setConfirm(false);
      setSavedWorkspace(JSON.stringify({ syllabus_text: response.workspace.syllabus_text, answers: response.workspace.answers, interpretation: response.workspace.interpretation, chosen: response.workspace.chosen }));
      setWorkspaceMessage('Avance del temario guardado. Puedes retomarlo al volver a abrir el curso. Los datos de la edición se guardan al publicar.');
    } catch (e) { setError(message(e)); } finally { setBusy(''); }
  }
  async function interpret() {
    if (busy) return;
    const supplied = answers.flatMap((answer, i) => answer?.trim() ? [`${result?.questions[i] ?? 'Aclaración'}\nRespuesta: ${answer.trim()}`] : []);
    const combinedAnswers = [...answerHistory, ...supplied];
    if (combinedAnswers.length > 3) { setError('Ya enviaste tres aclaraciones. Incorpora la información adicional al temario y vuelve a analizarlo; las aclaraciones anteriores siguen visibles.'); return; }
    const body = { syllabus_text: text, answers: combinedAnswers, consent: true as const };
    if (!consent) { setError('Autoriza el envío de este temario al asistente para continuar.'); return; }
    const parsed = SyllabusInterpretRequestSchema.safeParse(body);
    if (!parsed.success) { setError('Escribe un temario de hasta 5000 caracteres y respuestas de hasta 1000 caracteres.'); return; }
    setBusy('interpret'); setError('');
    try { const response = await interpretTrainingCourse(org, course.id, token, parsed.data); setResult(response); setChosen(response.proposals.map(() => true)); setAnswerHistory(parsed.data.answers); setAnswers([]); setConfirm(false); } catch (e) { setError(message(e)); } finally { setBusy(''); }
  }
  async function publish(e: React.FormEvent) {
    e.preventDefault(); if (busy || !result || !confirm || answers.some(a => a?.trim())) return;
    const selected = result.proposals.filter((_, i) => chosen[i]);
    const mapping = (prerequisite: boolean) => selected.filter(p => p.is_prerequisite === prerequisite).map(p => ({ competency_id: p.competency_id, description: p.description, quote: p.quote }));
    const body = { expected_updated_at: course.updated_at, syllabus_text: text, catalog_version_id: result.catalog_version_id, outcomes: mapping(false), prerequisites: mapping(true), confirm: true as const,
      edition: { ...edition, total_slots: Number(edition.total_slots), cost_amount: Number(edition.cost_amount), cost_currency: edition.cost_currency.toUpperCase(), cost_period: 'TOTAL' as const, sessions: sessions.map(s => ({ weekday: s.weekday, start_minute: minutes(s.start), end_minute: minutes(s.end), timezone: 'America/Panama' })) } };
    const parsed = TrainingCoursePublicationSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const labels: Record<string, string> = { outcomes: 'Habilidades que se aprenden', prerequisites: 'Conocimientos previos', sessions: 'Horarios', start_date: 'Fecha de inicio', end_date: 'Fecha final', total_slots: 'Cupos', cost_amount: 'Precio', cost_currency: 'Moneda', location: 'Lugar o plataforma', quote: 'Cita del temario', description: 'Descripción' };
      const field = [...issue.path].reverse().find(part => typeof part === 'string' && labels[part]);
      setError(`${typeof field === 'string' ? labels[field] : 'Publicación'}: revisa el valor ingresado. Las citas deben estar en el temario, las fechas y horarios deben estar ordenados y debes confirmar al menos una habilidad que se aprenda.`); return;
    }
    setBusy('publish'); setError('');
    try {
      const saved = await publishTrainingCourse(org, course.id, token, parsed.data, stableKey(publicationKey, parsed.data));
      setReceipt(saved); setResult(null); setConfirm(false);
      try { setCourse(await getTrainingCourse(org, course.id, token)); } catch { setError('La publicación se guardó. Vuelve a la lista para consultar la edición actualizada.'); }
    } catch (err) { setError(message(err)); } finally { setBusy(''); }
  }
  const updateEdition = (key: keyof typeof edition, value: string) => { setEdition(prev => ({ ...prev, [key]: value })); setConfirm(false); };
  return <main className={styles.content} aria-busy={Boolean(busy)}>
    <div><Button variant="text" disabled={Boolean(busy) || bankBusy} onClick={() => { if (!workspaceDirty || course.active || window.confirm('Hay cambios del temario sin guardar. ¿Volver sin guardarlos?')) onClose(); }}>← Volver a mis cursos</Button></div>
    <header><div className={styles.eyebrow}>{course.code} · {course.active ? 'PUBLICADO' : 'BORRADOR'}</div><h1>{course.title}</h1><p className={styles.muted}>{course.description}</p></header>
    {error && <Notice error>{error}</Notice>}
    {workspaceMessage && <Notice>{workspaceMessage}</Notice>}
    {receipt && <Notice title="Curso publicado">La edición ya está disponible para consulta. Recibo: {receipt.receipt_id}.</Notice>}
    {course.versions.map(version => <section className={styles.panel} key={version.id}><h2>Versión {version.version_number} publicada</h2><h3>Resultados de aprendizaje</h3><ul>{version.outcomes.map(item => <li key={item.competency_id}>{item.description}</li>)}</ul>{version.prerequisites.length > 0 && <><h3>Conocimientos previos</h3><ul>{version.prerequisites.map(item => <li key={item.competency_id}>{item.description}</li>)}</ul></>}<details><summary>Consultar temario publicado</summary><p style={{ whiteSpace: 'pre-wrap' }}>{version.syllabus_text}</p></details>{version.editions.map(ed => <div key={ed.id}><strong>{ed.location}</strong><p>{ed.start_date.slice(0,10)} al {ed.end_date.slice(0,10)} · {ed.available_slots} de {ed.total_slots} cupos disponibles</p></div>)}</section>)}
    {course.active && <Notice>La edición publicada ya puede consultarse desde Cursos. Agregar versiones o modificar ediciones publicadas queda pendiente de esta entrega.</Notice>}
    {course.active && <TrainingQuestionBankPanel org={org} course={course.id} token={token} onBusyChange={setBankBusy} />}
    {!course.active && <>
    <div className={styles.panel}><p>{workspaceDirty ? 'Tienes cambios del temario, respuestas o habilidades sin guardar.' : 'El avance del temario coincide con el último guardado.'}</p><p className={styles.muted}>Guardar avance conserva temario, aclaraciones y revisión de habilidades. Las fechas, precio y horarios se confirman al publicar la edición.</p><div><Button variant="secondary" disabled={Boolean(busy) || !workspaceDirty || !text.trim()} onClick={saveWorkspace}>{busy === 'workspace' ? 'Guardando avance…' : 'Guardar avance del temario'}</Button></div></div>
    <ol className={styles.steps} aria-label="Preparación del curso"><li aria-current={!result ? 'step' : undefined}>1. Temario</li><li aria-current={result ? 'step' : undefined}>2. Revisar habilidades</li><li>3. Publicar edición</li></ol>
    <section className={styles.panel}><h2>¿Qué aprenderán en este curso?</h2><p className={styles.muted}>Pega el contenido, objetivos y conocimientos previos. El asistente propondrá habilidades del catálogo; tú decides cuáles confirmar.</p><label className={styles.field}>Temario<textarea disabled={Boolean(busy)} maxLength={5000} value={text} onChange={e => { setText(e.target.value); setResult(null); setChosen([]); if (pendingAnswers.length) setAnswerHistory(prev => [...prev, ...pendingAnswers]); setAnswers([]); setConfirm(false); }} /></label><p className={styles.muted}>Guarda el avance para recuperar el temario, respuestas y habilidades al volver. No incluyas datos personales.</p><label className={styles.check}><input type="checkbox" checked={consent} disabled={Boolean(busy)} onChange={e => setConsent(e.target.checked)} />Autorizar el análisis de este temario mediante Vertex AI.</label>
      {answerHistory.length > 0 && <details><summary>Aclaraciones conservadas</summary>{answerHistory.map((answer, i) => <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{answer}</p>)}<Button variant="text" disabled={Boolean(busy)} onClick={() => { setAnswerHistory([]); setAnswers([]); setResult(null); setChosen([]); setConfirm(false); }}>Descartar aclaraciones y volver a analizar el temario</Button></details>}
      {result?.questions.map((question, i) => <label key={question} className={styles.field}>{question}<textarea maxLength={Math.max(1, 980 - question.length)} disabled={Boolean(busy)} value={answers[i] ?? ''} onChange={e => { setAnswers(prev => { const next = [...prev]; next[i] = e.target.value; return next; }); setConfirm(false); }} /></label>)}
      <div className={styles.actions}><Button disabled={Boolean(busy) || !consent || !text.trim()} onClick={interpret}>{busy === 'interpret' ? 'Analizando temario…' : result?.questions.length ? 'Actualizar propuestas con mis respuestas' : 'Analizar temario'}</Button>{busy === 'interpret' && <span role="status">Estamos revisando el contenido. No cierres esta vista.</span>}</div>
    </section>
    {result && <form className={styles.stack} onSubmit={publish}>
      <section className={styles.panel}><h2>Revisar habilidades propuestas</h2><p>Desmarca lo que no corresponda. Las citas permiten comprobar de dónde sale cada propuesta.</p>{!result.proposals.length && <Notice>No se identificaron habilidades del catálogo. Amplía el temario o responde las preguntas antes de publicar.</Notice>}{result.proposals.map((proposal, i) => <article className={styles.proposal} key={`${proposal.competency_id}:${i}`}><label className={styles.check}><input type="checkbox" checked={chosen[i] ?? false} disabled={Boolean(busy)} onChange={e => { setChosen(prev => prev.map((v, n) => n === i ? e.target.checked : v)); setConfirm(false); }} /><strong>{proposal.name}</strong></label><span className={styles.badge}>{proposal.is_prerequisite ? 'Se necesita antes de empezar' : 'Se aprende en el curso'}</span><p>{proposal.description}</p><blockquote>«{proposal.quote}»</blockquote></article>)}</section>
      <section className={styles.panel}><h2>Preparar la edición</h2><div className={styles.grid}>
        <label className={styles.field}>Modalidad<select disabled={Boolean(busy)} value={edition.modality} onChange={e => updateEdition('modality', e.target.value)}><option value="REMOTE">Remoto</option><option value="ON_SITE">Presencial</option><option value="HYBRID">Híbrido</option></select></label>
        <Field id="edition-location" label="Lugar o plataforma" required maxLength={200} disabled={Boolean(busy)} value={edition.location} onChange={e => updateEdition('location', e.target.value)} />
        <Field id="edition-start" type="date" label="Fecha de inicio" required disabled={Boolean(busy)} value={edition.start_date} onChange={e => updateEdition('start_date', e.target.value)} /><Field id="edition-end" type="date" label="Fecha final" required min={edition.start_date} disabled={Boolean(busy)} value={edition.end_date} onChange={e => updateEdition('end_date', e.target.value)} />
        <Field id="edition-slots" type="number" label="Cupos totales" required min={1} max={10000} disabled={Boolean(busy)} value={edition.total_slots} onChange={e => updateEdition('total_slots', e.target.value)} /><Field id="edition-price" type="number" label="Precio total (0 si es gratuito)" required min={0} step="0.01" disabled={Boolean(busy)} value={edition.cost_amount} onChange={e => updateEdition('cost_amount', e.target.value)} /><Field id="edition-currency" label="Moneda" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" disabled={Boolean(busy)} value={edition.cost_currency} onChange={e => updateEdition('cost_currency', e.target.value)} />
      </div><h3>Horario semanal · Panamá</h3><div className={styles.sessions}>{sessions.map((s, i) => <div className={styles.session} key={i}><label className={styles.field}>Día<select disabled={Boolean(busy)} value={s.weekday} onChange={e => { setSessions(prev => prev.map((row,n) => n === i ? { ...row, weekday: Number(e.target.value) } : row)); setConfirm(false); }}>{weekdays.map((day, n) => <option key={day} value={n + 1}>{day}</option>)}</select></label><Field id={`session-start-${i}`} label="Inicio" type="time" required disabled={Boolean(busy)} value={s.start} onChange={e => { setSessions(prev => prev.map((row,n) => n === i ? { ...row, start: e.target.value } : row)); setConfirm(false); }} /><Field id={`session-end-${i}`} label="Fin" type="time" required disabled={Boolean(busy)} value={s.end} onChange={e => { setSessions(prev => prev.map((row,n) => n === i ? { ...row, end: e.target.value } : row)); setConfirm(false); }} /><Button variant="text" type="button" disabled={Boolean(busy) || sessions.length === 1} onClick={() => { setSessions(prev => prev.filter((_,n) => n !== i)); setConfirm(false); }}>Quitar</Button></div>)}</div><div><Button type="button" variant="secondary" disabled={Boolean(busy) || sessions.length >= 30} onClick={() => { setSessions(prev => [...prev, { weekday: 1, start: '09:00', end: '11:00' }]); setConfirm(false); }}>Añadir horario</Button></div>
      {answers.some(a => a?.trim()) && <Notice>Actualiza primero las propuestas con tus respuestas antes de confirmar la publicación.</Notice>}
      <label className={styles.check}><input type="checkbox" checked={confirm} disabled={Boolean(busy) || answers.some(a => a?.trim())} onChange={e => setConfirm(e.target.checked)} />He revisado las habilidades, prerrequisitos, precio, fechas y cupos. Confirmar publicación de esta edición.</label><div className={styles.actions}><Button type="submit" disabled={Boolean(busy) || !confirm || answers.some(a => a?.trim()) || !result.proposals.some((p,i) => chosen[i] && !p.is_prerequisite)}>{busy === 'publish' ? 'Publicando…' : 'Confirmar y publicar edición'}</Button></div></section>
    </form>}
    </>}
  </main>;
}
