import { useEffect, useRef, useState } from 'react';
import { useSession } from '../../app/session';
import { Button, Notice } from '../../components/Controls';
import { fetchWithHeaders } from '../../lib/api';
import type { InterpretationRunView, SuggestionBatchDecisionResponse } from '@equipo10/contracts';
import { getProfileProposalIssues } from '@equipo10/contracts';
import { ProposalCard, proposalTitle, sectionLabels, canSaveSection, type ProposalChoice } from './ProposalCard';
import styles from './A02SuggestionsViewer.module.css';

type Stage = 'overview' | 'questions' | 'review' | 'summary';
const stages: Stage[] = ['overview', 'questions', 'review', 'summary'];
const titles = ['Lo que encontramos', 'Completar detalles', 'Elegir tus datos', 'Revisar y guardar'];

export function A02SuggestionsViewer({ runView, draftRevision, onDecisionsApplied, onDismiss, onClarify }: {
  runView: InterpretationRunView;
  draftRevision: number;
  onDecisionsApplied: (response: SuggestionBatchDecisionResponse) => void;
  onDismiss: () => void;
  onClarify: (answers: string) => void;
}) {
  const { session } = useSession();
  // Answer questions before selecting proposals, so a new run cannot erase previous choices.
  const [stage, setStage] = useState<Stage>(runView.goal === 'clarify_profile' ? 'review' : 'overview');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [decisions, setDecisions] = useState<Record<string, ProposalChoice>>({});
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [confirmExit, setConfirmExit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const current = runView.suggestions[itemIndex];
  const question = runView.questions[questionIndex];
  const accepted = runView.suggestions.filter((s) => decisions[s.suggestion_id] === 'accept' && canSaveSection(s.section));
  const hasDecisions = runView.suggestions.some((s) => canSaveSection(s.section) && ['accept', 'reject'].includes(decisions[s.suggestion_id] || 'defer'));
  const answered = Object.values(answers).some((answer) => answer.trim());
  useEffect(() => {
    heading.current?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'auto' });
    heading.current?.focus({ preventScroll: true });
  }, [stage, itemIndex, questionIndex]);

  const startReview = () => { setStage(runView.suggestions.length ? 'review' : 'summary'); setItemIndex(0); };
  const checkProposal = (index: number) => {
    const suggestion = runView.suggestions[index];
    if (decisions[suggestion.suggestion_id] !== 'accept') return true;
    const issues = getProfileProposalIssues(suggestion.section, edits[suggestion.suggestion_id] ?? suggestion.proposed_value);
    if (!issues.length) return true;
    setStage('review'); setItemIndex(index);
    setError(`${proposalTitle(suggestion)}: ${issues[0].message}`);
    return false;
  };
  const handleApply = async () => {
    if (!session?.access_token || busy.current || !hasDecisions) return;
    if (runView.suggestions.some((_, index) => !checkProposal(index))) return;
    const body = { run_id: runView.run_id, decisions: runView.suggestions.map((suggestion) => ({
      suggestion_id: suggestion.suggestion_id,
      decision: canSaveSection(suggestion.section) ? decisions[suggestion.suggestion_id] || 'defer' : 'defer',
      ...(edits[suggestion.suggestion_id] && decisions[suggestion.suggestion_id] === 'accept' ? { replacement_value: edits[suggestion.suggestion_id] } : {}),
    })) };
    const payload = JSON.stringify(body);
    if (!attempt.current || attempt.current.payload !== payload) attempt.current = { payload, key: 'profile-choices-' + crypto.randomUUID() };
    busy.current = true; setSubmitting(true); setError(null);
    try {
      const response = await fetchWithHeaders<SuggestionBatchDecisionResponse>('/me/candidate-profile/draft/suggestion-decisions', session.access_token, {
        method: 'POST', body, headers: { 'If-Match': String(draftRevision), 'Idempotency-Key': attempt.current.key },
      });
      onDecisionsApplied(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos comprobar el guardado. Reintenta sin cambiar tus decisiones.');
    } finally { busy.current = false; setSubmitting(false); }
  };

  return <section className={styles.container} aria-label="Preparar mi trayectoria" aria-busy={submitting}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>Paso {stages.indexOf(stage) + 1} de 4 · Tu trayectoria</span>
        <h2 ref={heading} tabIndex={-1} className={styles.title}>{titles[stages.indexOf(stage)]}</h2>
      </div>
      <Button variant="text" onClick={() => setConfirmExit(true)} disabled={submitting}>Salir del asistente</Button>
    </header>
    <progress className={styles.mobileProgress} max={4} value={stages.indexOf(stage) + 1} aria-label="Avance de la revisión" />
    <ol className={styles.steps} aria-label="Pasos del asistente">
      {stages.map((step, index) => <li key={step} aria-current={step === stage ? 'step' : undefined} data-current={step === stage}><span>{index + 1}</span>{titles[index]}</li>)}
    </ol>
    {confirmExit && <div className={styles.exit} role="alert">
      <p>Tus decisiones de esta revisión aún no están guardadas. ¿Prefieres completar el perfil manualmente?</p>
      <Button variant="secondary" onClick={() => setConfirmExit(false)}>Seguir revisando</Button>
      <Button variant="text" onClick={onDismiss}>Salir sin añadir estos datos</Button>
    </div>}
    {error && <Notice error>{error}</Notice>}
    {submitting && <Notice>Guardando tus datos… No necesitas volver a pulsar.</Notice>}

    {stage === 'overview' && <>
      <p>Leímos tu información. Primero puedes completar algunos detalles; después elegirás qué añadir. Nada se guarda en tu perfil sin tu confirmación.</p>
      <ul className={styles.counts}>{Object.entries(sectionLabels).map(([key, label]) => {
        const count = runView.suggestions.filter((suggestion) => suggestion.section === key).length;
        return count ? <li key={key}><strong>{count}</strong>{label}</li> : null;
      })}</ul>
      <p className={styles.subtitle}>{runView.questions.length ? 'Hay ' + runView.questions.length + ' preguntas opcionales. Si no recuerdas una fecha, puedes dejarla pendiente.' : 'No hace falta responder más preguntas para revisar lo encontrado.'}</p>
      <footer className={styles.footer}>
        {runView.questions.length > 0 && <Button disabled={Object.keys(decisions).length > 0} onClick={() => setStage('questions')}>Completar con preguntas</Button>}
        <Button variant={runView.questions.length ? 'secondary' : 'primary'} onClick={startReview}>Revisar lo encontrado</Button>
      </footer>
    </>}

    {stage === 'questions' && <>
      {question ? <div className={styles.questionPanel}>
        <p className={styles.eyebrow}>Pregunta {questionIndex + 1} de {runView.questions.length} · Opcional</p>
        <label htmlFor="interview-answer" className={styles.questionTitle}>{question.text}</label>
        <p id="interview-help" className={styles.subtitle}>Cuéntalo con tus palabras. Una fecha aproximada está bien; no necesitas inventar el mes ni recordar todo.</p>
        <textarea id="interview-answer" className={styles.answer} aria-describedby="interview-help" maxLength={2000} value={answers[questionIndex] || ''}
          onChange={(event) => setAnswers((old) => ({ ...old, [questionIndex]: event.target.value }))} />
        <footer className={styles.footer}>
          <Button variant="text" onClick={() => questionIndex ? setQuestionIndex(questionIndex - 1) : setStage('overview')}>Volver</Button>
          <Button variant="secondary" onClick={() => { setAnswers((old) => ({ ...old, [questionIndex]: '' })); setQuestionIndex(questionIndex + 1); }}>No lo recuerdo</Button>
          <Button onClick={() => setQuestionIndex(questionIndex + 1)} disabled={!answers[questionIndex]?.trim()}>Siguiente pregunta</Button>
        </footer>
      </div> : <div className={styles.questionPanel}>
        <h3>Ya puedes revisar tu información</h3>
        <p>{answered ? 'Usaremos tus respuestas junto con el documento original para actualizar los datos propuestos. Después podrás elegirlos uno por uno.' : 'Está bien dejar detalles pendientes. Puedes revisar lo encontrado y completar lo demás manualmente.'}</p>
        {answered && <p className={styles.subtitle}>Al continuar autorizas el análisis de estas respuestas y las fuentes originales mediante Vertex AI.</p>}
        <footer className={styles.footer}>
          <Button variant="text" onClick={() => setQuestionIndex(Math.max(0, runView.questions.length - 1))}>Revisar mis respuestas</Button>
          {answered && <Button onClick={() => onClarify(runView.questions.map((item, index) => answers[index]?.trim() ? 'Pregunta: ' + item.text + '\nRespuesta: ' + answers[index].trim() : '').filter(Boolean).join('\n\n'))}>Usar mis respuestas</Button>}
          <Button variant="secondary" onClick={startReview}>{answered ? 'Continuar sin usar estas respuestas' : 'Revisar lo encontrado'}</Button>
        </footer>
      </div>}
      {question && <Button variant="text" onClick={startReview}>Omitir preguntas y revisar los datos</Button>}
    </>}

    {stage === 'review' && <>
      {current ? <>
        <p className={styles.subtitle}>Dato {itemIndex + 1} de {runView.suggestions.length}. Lo que dejes pendiente no se añadirá a tu perfil.</p>
        <ProposalCard key={current.suggestion_id} suggestion={current} choice={decisions[current.suggestion_id] || 'defer'} replacement={edits[current.suggestion_id]}
          onChoice={(choice) => { setError(null); setDecisions((old) => ({ ...old, [current.suggestion_id]: choice })); }}
          onEdit={(value) => { setError(null); setEdits((old) => ({ ...old, [current.suggestion_id]: value })); }} />
        <footer className={styles.footer}>
          <Button variant="text" onClick={() => itemIndex ? setItemIndex(itemIndex - 1) : setStage('overview')}>Volver</Button>
          <Button onClick={() => { if (!checkProposal(itemIndex)) return; setError(null); itemIndex + 1 < runView.suggestions.length ? setItemIndex(itemIndex + 1) : setStage('summary'); }}>{itemIndex + 1 < runView.suggestions.length ? 'Siguiente dato' : 'Ver resumen'}</Button>
        </footer>
      </> : <><p>No hay datos propuestos. Puedes añadir tu experiencia manualmente.</p><Button onClick={() => setStage('summary')}>Continuar al resumen</Button></>}
    </>}

    {stage === 'summary' && <>
      <h3>{accepted.length ? 'Vas a añadir ' + accepted.length + (accepted.length === 1 ? ' dato' : ' datos') : 'No has elegido datos para añadir'}</h3>
      <ul className={styles.summary}>{accepted.map((suggestion) => <li key={suggestion.suggestion_id}><span>{sectionLabels[suggestion.section]}</span><strong>{String(edits[suggestion.suggestion_id]?.title || edits[suggestion.suggestion_id]?.name || edits[suggestion.suggestion_id]?.original_text || proposalTitle(suggestion))}</strong></li>)}</ul>
      <p>Los demás datos quedan fuera de este guardado. Después podrás añadir otras experiencias y cursos en el formulario. Tu perfil seguirá siendo privado.</p>
      <footer className={styles.footer}>
        <Button variant="secondary" disabled={submitting} onClick={startReview}>Cambiar mis elecciones</Button>
        {hasDecisions ? <Button disabled={submitting} onClick={handleApply}>{submitting ? 'Guardando…' : accepted.length ? 'Añadir al borrador y seguir editando' : 'Guardar elecciones y continuar'}</Button>
          : <Button onClick={onDismiss}>Continuar manualmente sin añadir datos</Button>}
      </footer>
    </>}
  </section>;
}
