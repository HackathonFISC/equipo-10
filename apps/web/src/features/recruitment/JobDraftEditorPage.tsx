import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { PublishOpportunityDraftRequestSchema, type OpportunityDraftView } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice, Field } from '../../components/Controls';
import styles from './recruitment.module.css';

export function JobDraftEditorPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { session, me } = useSession();
  const authorized=me?.contexts.some(c=>c.organization.id===orgId&&c.organization.type==='COMPANY'&&['ADMIN','RECRUITER'].includes(c.role));

  const [rawText, setRawText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<OpportunityDraftView | null>(null);

  // Form fields that recruiter can adjust before publishing
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Panamá, Panamá');
  const [workplaceType, setWorkplaceType] = useState<'ON_SITE' | 'HYBRID' | 'REMOTE'>('ON_SITE');
  const [salaryAmount, setSalaryAmount] = useState<number>(750);
  const [availableSlots, setAvailableSlots] = useState<number>(1);
  const [scheduleSummary, setScheduleSummary] = useState('Lunes a Viernes 8:00 AM - 5:00 PM');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [requirements,setRequirements]=useState<OpportunityDraftView['proposed_requirements']>([]);
  const [confirmed,setConfirmed]=useState(false);
  const [savingAnswers,setSavingAnswers]=useState(false);
  const busy=analyzing||publishing||savingAnswers;
  useEffect(()=>{setConfirmed(false);},[rawText,title,location,workplaceType,salaryAmount,availableSlots,scheduleSummary,requirements,answers]);
  const storageKey=`vacancy-draft:${me?.user.id??''}:${orgId}`;
  function useDraft(value:OpportunityDraftView){
    setDraft(value);setRawText(value.raw_text);setTitle(value.title??'');setLocation(value.location??'');
    setWorkplaceType(value.workplace_type);setSalaryAmount(value.salary_amount??0);setAvailableSlots(value.available_slots);setScheduleSummary(value.schedule_summary??'');
    setRequirements(value.proposed_requirements);setAnswers(Object.fromEntries(value.clarification_answers.map(a=>[a.question,a.answer])));setConfirmed(false);
  }
  useEffect(()=>{
    if(!session?.access_token||!orgId||!authorized)return;
    let saved:string|null=null;try{saved=sessionStorage.getItem(storageKey);}catch{}
    if(!saved)return;let alive=true;setAnalyzing(true);
    fetchData<OpportunityDraftView>(`/organizations/${orgId}/drafts/${saved}`,session.access_token)
      .then(value=>{if(alive)useDraft(value);}).catch(()=>{if(alive)setError('No se pudo recuperar el borrador guardado en esta pestaña. Puedes reintentar al recargar.');})
      .finally(()=>{if(alive)setAnalyzing(false);});
    return()=>{alive=false;};
  },[session?.access_token,orgId,authorized,storageKey]);
  async function updateAnswers(){
    if(!draft||!orgId||!session||analyzing||publishing||savingAnswers)return;
    setSavingAnswers(true);setError(null);
    try{const updated=await fetchData<OpportunityDraftView>(`/organizations/${orgId}/drafts/${draft.id}`,session.access_token,'PATCH',{
      clarification_answers:Object.entries(answers).filter(([,answer])=>answer.trim()).map(([question,answer])=>({question,answer})),
    });useDraft(updated);}catch(e){setError(e instanceof Error?e.message:'No pudimos revisar las respuestas; se conservan en pantalla.');}finally{setSavingAnswers(false);}
  }

  const handleAnalyze = async () => {
    if (!session?.access_token || !orgId || !authorized || rawText.trim().length<10 || analyzing || publishing || savingAnswers) return;
    try {
      setAnalyzing(true);
      setError(null);
      const res = await fetchData<OpportunityDraftView>(
        `/organizations/${orgId}/drafts`,
        session.access_token,
        'POST',
        { raw_text: rawText, location,workplace_type:workplaceType,salary_amount:salaryAmount,salary_currency:'USD',salary_period:'MONTH',schedule_summary:scheduleSummary,available_slots:availableSlots }
      );
      useDraft(res);try{sessionStorage.setItem(storageKey,res.id);}catch{}
    } catch (err: any) {
      setError(err.message || 'Error al analizar la vacante con el Agente A01.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePublish = async () => {
    if (!session?.access_token || !orgId || !draft || !confirmed || analyzing || publishing || savingAnswers) return;
    if(rawText!==draft.raw_text){setError('El texto cambió. Analiza de nuevo la descripción antes de publicar.');return;}
    if(Object.entries(answers).some(([question,answer])=>answer.trim()!== (draft.clarification_answers.find(a=>a.question===question)?.answer??'').trim())){setError('Actualiza primero la propuesta con tus respuestas.');return;}
    const body=PublishOpportunityDraftRequestSchema.safeParse({title,occupation_id:draft.occupation_id,location,workplace_type:workplaceType,
      salary_amount:salaryAmount,salary_currency:'USD',salary_period:'MONTH',schedule_summary:scheduleSummary,available_slots:availableSlots,
      requirements:requirements.map(r=>({competency_id:r.competency_id,requirement_type:r.requirement_type,stage:r.stage,description:r.description})),
    });
    if(!body.success){setError('Revisa el título, puesto identificado, habilidades, ubicación, salario, horario y plazas antes de publicar.');return;}
    try {
      setPublishing(true);
      setError(null);
      await fetchData<unknown>(
        `/organizations/${orgId}/drafts/${draft.id}/publish`,
        session.access_token,
        'POST',
        body.data
      );

      try{sessionStorage.removeItem(storageKey);}catch{}
      navigate(`/organizaciones/${orgId}/vacantes`);
    } catch (err: any) {
      setError(err.message || 'No se pudo publicar la vacante.');
    } finally {
      setPublishing(false);
    }
  };

  if(!authorized)return <Notice title="Acceso de empresa">Necesitas permisos en una empresa activa para gestionar vacantes.</Notice>;
  return (
    <div className={styles.container}>
      <div>
        <Link to={`/organizaciones/${orgId}/vacantes`} style={{ color: 'var(--color-action)', textDecoration: 'none', fontWeight: 600 }}>
          ← Volver a vacantes de la empresa
        </Link>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Nueva Vacante con Orientación A01</h1>
          <p className={styles.subtitle}>
            Describe las responsabilidades y necesidades en texto libre. El Agente A01 vinculará el puesto y competencias al catálogo oficial y detectará sesgos.
          </p>
        </div>
      </div>

      {error && <Notice error title="Error">{error}</Notice>}

      <div className={styles.card}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>1. Descripción libre del puesto</h3>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)' }}>
          Pega o escribe las funciones, requisitos de ingreso y tareas que la persona desarrollará en la empresa.
        </p>
        <textarea
          data-testid="job-raw-text"
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 'var(--radius-control)',
            border: '1px solid var(--color-border)',
            fontFamily: 'inherit',
            fontSize: '15px',
            boxSizing: 'border-box',
          }}
          placeholder="Ej: Buscamos un auxiliar para organizar paquetes, verificar inventario y realizar despacho en bodega. Horario diurno de lunes a viernes."
          value={rawText}
          maxLength={5000}
          disabled={busy}
          onChange={(e) => setRawText(e.target.value)}
        />

        <div>
          <Button
            data-testid="analyze-draft-button"
            onClick={handleAnalyze}
            disabled={busy || rawText.trim().length<10}
          >
            {analyzing ? 'Agente A01 analizando catálogo y sesgos...' : draft ? 'Analizar descripción en un nuevo borrador' : 'Analizar vacante con Agente A01'}
          </Button>
        </div>
      </div>

      {draft && (
        <div className={styles.card} data-testid="a01-proposal-card">
          <p>El borrador se conserva para retomarlo en esta pestaña. Si corriges el texto original, vuelve a analizarlo antes de publicar.</p>
          <p><strong>Puesto del catálogo:</strong> {draft.occupation_name??'Pendiente de identificar'}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>2. Propuesta estructurada por Agente A01</h3>
            <span className={`${styles.badge} ${draft.has_blocking_issues ? styles.badgeDanger : styles.badgeSuccess}`}>
              {draft.has_blocking_issues ? 'Bloqueado por sesgos' : 'Estructura validada'}
            </span>
          </div>

          {draft.discriminatory_warnings && draft.discriminatory_warnings.length > 0 && (
            <div className={styles.warningBox} data-testid="discriminatory-warning-box">
              <div className={styles.warningTitle}>
                ⚠️ Criterios discriminatorios detectados (Publicación Bloqueada)
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
                La plataforma prohíbe cláusulas de edad, sexo/género, estado civil o apariencia física. Corrige la descripción para habilitar la publicación:
              </p>
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                {draft.discriminatory_warnings.map((w, i) => (
                  <li key={i} className={styles.warningItem}>
                    <strong>{w.field}:</strong> {w.explanation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.clarification_questions && draft.clarification_questions.length > 0 && (
            <div style={{ background: 'var(--color-surface-subtle)', padding: '16px', borderRadius: 'var(--radius-control)' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '15px' }}>Preguntas del orientador para afinar la vacante:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {draft.clarification_questions.map((q, idx) => (
                  <div key={idx}>
                    <label htmlFor={`vacancy-answer-${idx}`} style={{ fontSize: '14px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                      {q}
                    </label>
                    <input
                      id={`vacancy-answer-${idx}`}
                      disabled={busy}
                      type="text"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        boxSizing: 'border-box',
                      }}
                      placeholder="Respuesta aclaratoria..."
                      value={answers[q] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <Button variant="secondary" disabled={busy||rawText!==draft.raw_text} onClick={updateAnswers}>{savingAnswers?'Revisando aclaraciones…':'Actualizar propuesta con mis respuestas'}</Button>
            </div>
          )}

          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '16px' }}>Habilidades vinculadas al catálogo oficial ({requirements.length})</h4>
            <div className={styles.reqGrid}>
              {requirements.map((req, i) => (
                <div key={i} className={styles.reqItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{req.competency_name || 'Competencia del catálogo'}</span>
                    <span className={styles.badge} style={{ background: 'var(--color-divider)' }}>
                      {req.requirement_type === 'ESSENTIAL' ? 'Esencial' : 'Deseable'}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                    {req.description} ({req.stage === 'ENTRY' ? 'Requisito de entrada' : 'Entrenable en puesto'})
                  </span>
                  <label>Prioridad<select disabled={busy} value={req.requirement_type} onChange={e=>setRequirements(prev=>prev.map((item,n)=>n===i?{...item,requirement_type:e.target.value as 'ESSENTIAL'|'DESIRABLE'}:item))}><option value="ESSENTIAL">Esencial</option><option value="DESIRABLE">Deseable</option></select></label>
                  <label>Momento de aprendizaje<select disabled={busy} value={req.stage} onChange={e=>setRequirements(prev=>prev.map((item,n)=>n===i?{...item,stage:e.target.value as 'ENTRY'|'TRAINABLE'}:item))}><option value="ENTRY">Se necesita al ingresar</option><option value="TRAINABLE">Se aprende en el puesto</option></select></label>
                  <Button variant="text" disabled={busy} onClick={()=>setRequirements(prev=>prev.filter((_,n)=>n!==i))}>Quitar requisito</Button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--color-divider)', paddingTop: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px' }}>3. Confirmar datos operativos antes de publicar</h4>

            <Field
              id="title-input"
              disabled={busy}
              label="Título del puesto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <Field
                id="location-input"
                disabled={busy}
                label="Ubicación"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="workplace-select" style={{ fontSize: '14px', fontWeight: 500 }}>Modalidad</label>
                <select
                  id="workplace-select"
                  disabled={busy}
                  value={workplaceType}
                  onChange={(e) => setWorkplaceType(e.target.value as any)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-control)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <option value="ON_SITE">Presencial</option>
                  <option value="HYBRID">Híbrida</option>
                  <option value="REMOTE">Remota</option>
                </select>
              </div>

              <Field
                id="salary-input"
                disabled={busy}
                label="Salario mensual (USD)"
                type="number"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(parseFloat(e.target.value) || 0)}
              />

              <Field
                id="slots-input"
                disabled={busy}
                label="Plazas disponibles"
                type="number"
                min={1}
                value={availableSlots}
                onChange={(e) => setAvailableSlots(parseInt(e.target.value, 10) || 1)}
              />
            </div>

            <Field
              id="schedule-input"
              disabled={busy}
              label="Resumen de jornada y horarios"
              value={scheduleSummary}
              onChange={(e) => setScheduleSummary(e.target.value)}
            />

            <div>
              <label><input type="checkbox" disabled={busy||draft.status==='PUBLISHED'} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />He revisado el puesto, habilidades y condiciones. Confirmo publicar esta vacante.</label>
              <Button
                data-testid="publish-job-button"
                onClick={handlePublish}
                disabled={busy || draft.has_blocking_issues || !confirmed || draft.status==='PUBLISHED'}
                style={{ width: '100%' }}
              >
                {publishing ? 'Publicando vacante...' : draft.has_blocking_issues ? 'No se puede publicar con sesgos detectados' : 'Confirmar y publicar vacante'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
