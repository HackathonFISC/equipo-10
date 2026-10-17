import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router';
import type {
  OpportunityDetailView,
  OpportunityComparisonView,
  OpportunityExplanationView,
  CandidateApplicationView,
} from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { useProfileView } from '../profile/useProfileView';
import { Button, Notice, Field } from '../../components/Controls';
import { ComparisonResultsCard } from './ComparisonResultsCard';
import styles from './opportunities.module.css';

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const { profile } = useProfileView();

  const [opportunity, setOpportunity] = useState<OpportunityDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Application state (D5/D6)
  const [myApplication, setMyApplication] = useState<CandidateApplicationView | null>(null);
  const [applying, setApplying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const applyOperation=useRef<{payload:string;key:string}|null>(null);
  const withdrawOperation=useRef<string|null>(null);

  // Assumptions state
  const [commuteMinutes, setCommuteMinutes] = useState<number>(30);

  // Comparison state
  const [comparison, setComparison] = useState<OpportunityComparisonView | null>(null);
  const [comparing, setComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Explanation state (A03)
  const [explanation, setExplanation] = useState<OpportunityExplanationView | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  const loadOpportunity = useCallback(async () => {
    if (!session?.access_token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchData<OpportunityDetailView>(`/opportunities/${id}`, session.access_token);
      setOpportunity(data);
    } catch {
      setError('No se pudo cargar el detalle de la vacante solicitada.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, id]);

  const loadApplication = useCallback(async () => {
    if (!session?.access_token || !id) return;
    try {
      const res = await fetchData<{ items: CandidateApplicationView[] }>(
        '/me/applications',
        session.access_token
      );
      setMyApplication(res.items.find(application=>application.opportunity_id===id)??null);
    } catch {
      setMyApplication(null);
    }
  }, [session?.access_token, id]);

  useEffect(() => {
    loadOpportunity();
    loadApplication();
  }, [loadOpportunity, loadApplication]);

  const handleApply = async () => {
    if (!session?.access_token || !id || !profile?.current_version_id || applying || withdrawing) return;
    try {
      setApplying(true);
      setApplicationError(null);
      const payload=JSON.stringify({id,version:profile.current_version_id,withdrawn_at:myApplication?.withdrawn_at??null});
      if(applyOperation.current?.payload!==payload)applyOperation.current={payload,key:crypto.randomUUID()};
      const idempotencyKey=applyOperation.current.key;
      const res = await fetchData<CandidateApplicationView>(
        `/opportunities/${id}/applications`,
        session.access_token,
        'POST',
        { profile_revision_id: profile.current_version_id, consent_confirmed:true, idempotency_key:idempotencyKey },
        undefined,
        { 'Idempotency-Key': idempotencyKey }
      );
      setMyApplication(res);
      withdrawOperation.current=null;
    } catch (err: any) {
      setApplicationError(err.message || 'No se pudo registrar la candidatura consentida.');
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!session?.access_token || !id || !myApplication || applying || withdrawing) return;
    if (!window.confirm('¿Deseas retirar tu postulación? La empresa perderá inmediatamente el acceso a tus habilidades y evidencias comprobadas.')) {
      return;
    }
    try {
      setWithdrawing(true);
      setApplicationError(null);
      withdrawOperation.current??=crypto.randomUUID();
      const res = await fetchData<CandidateApplicationView>(
        `/me/applications/${myApplication.id}/withdrawal`,
        session.access_token,
        'POST',
        { reason: 'Retirada voluntaria del candidato', idempotency_key:withdrawOperation.current },
        undefined,
        { 'Idempotency-Key':withdrawOperation.current }
      );
      setMyApplication(res);
      applyOperation.current=null;
    } catch (err: any) {
      setApplicationError(err.message || 'No se pudo retirar la postulación.');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleRunComparison = async () => {
    if (!session?.access_token || !id || !profile?.current_version_id) return;
    try {
      setComparing(true);
      setComparisonError(null);

      // Generate stable idempotency key based on candidate profile version and inputs
      const idempotencyKey = `idem-comp-${id.slice(0, 8)}-${profile.current_version_id.slice(0, 8)}-m${commuteMinutes}`;

      const res = await fetchData<OpportunityComparisonView>(
        '/me/opportunity-comparisons',
        session.access_token,
        'POST',
        {
          opportunity_id: id,
          assumptions: {
            commute_minutes: commuteMinutes,
          },
        },
        undefined,
        {
          'Idempotency-Key': idempotencyKey,
        }
      );

      setComparison(res);
      setExplanation(null);
    } catch (err: any) {
      setComparisonError(err.message || 'No se pudo calcular la comparación con tu perfil.');
    } finally {
      setComparing(false);
    }
  };

  const handleRequestExplanation = async () => {
    if (!session?.access_token || !comparison?.id) return;
    try {
      setLoadingExplanation(true);
      setExplanationError(null);

      const idempotencyKey = `idem-expl-${comparison.id.slice(0, 8)}-v${comparison.opportunity_version}`;

      const res = await fetchData<OpportunityExplanationView>(
        `/me/opportunity-comparisons/${comparison.id}/explanations`,
        session.access_token,
        'POST',
        {
          consent: true,
          answers: [],
        },
        undefined,
        {
          'Idempotency-Key': idempotencyKey,
        }
      );

      setExplanation(res);
    } catch (err: any) {
      setExplanationError(err.message || 'El orientador A03 no pudo generar la explicación en este momento.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  const hasConfirmedProfile = Boolean(profile?.current_version_id);

  const formatWorkplaceType = (type: string) => {
    switch (type) {
      case 'ON_SITE':
        return 'Presencial';
      case 'REMOTE':
        return 'Remoto';
      case 'HYBRID':
        return 'Híbrido';
      default:
        return type;
    }
  };

  const formatSalary = (amount: string | null, currency: string | null, period: string | null) => {
    if (!amount) return 'Salario a convenir';
    const periodLabel = period === 'MONTH' ? '/ mes' : period === 'HOUR' ? '/ hora' : '';
    return `$${amount} ${currency || 'USD'} ${periodLabel}`.trim();
  };

  if (loading) {
    return (
      <div className={styles.emptyState} role="status">
        <p>Cargando detalle de la vacante...</p>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className={styles.container}>
        <Notice error title="Error">
          {error || 'Vacante no encontrada.'}
        </Notice>
        <div>
          <Link to="/explorar" className={styles.navLink}>
            ← Volver a explorar oportunidades
          </Link>
        </div>
      </div>
    );
  }

  const entryReqs = opportunity.requirements.filter((r) => r.stage === 'ENTRY');
  const trainableReqs = opportunity.requirements.filter((r) => r.stage === 'TRAINABLE');

  return (
    <div className={styles.container}>
      <div>
        <Link to="/explorar" style={{ color: 'var(--color-action)', textDecoration: 'none', fontWeight: 600 }}>
          ← Volver a oportunidades
        </Link>
      </div>

      <div className={styles.detailContainer}>
        {/* Left Column: Vacancy Details & Requirements */}
        <div className={styles.detailCard}>
          <div className={styles.cardHeader}>
            <div className={styles.badges}>
              {opportunity.is_demo && (
                <span className={`${styles.badge} ${styles.badgeDemo}`}>Demo</span>
              )}
              <span className={`${styles.badge} ${styles.badgeWorkplace}`}>
                {formatWorkplaceType(opportunity.workplace_type)}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
              Versión {opportunity.version}
            </span>
          </div>

          <div>
            <h1 className={styles.detailTitle}>{opportunity.title}</h1>
            <p className={styles.orgName} style={{ fontSize: '16px', marginTop: '4px' }}>
              {opportunity.organization.name}
            </p>
          </div>

          <div className={styles.cardMeta} style={{ fontSize: '15px' }}>
            <div className={styles.metaItem}>
              <span>📍 Ubicación: {opportunity.location}</span>
            </div>
            <div className={styles.metaItem}>
              <span>💵 Salario: {formatSalary(opportunity.salary_amount, opportunity.salary_currency, opportunity.salary_period)}</span>
            </div>
            {opportunity.schedule_summary && (
              <div className={styles.metaItem}>
                <span>⏱️ Jornada: {opportunity.schedule_summary}</span>
              </div>
            )}
            <div className={styles.metaItem}>
              <span>👥 Plazas: {opportunity.available_slots} disponible{opportunity.available_slots === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px' }}>Descripción del puesto</h3>
            <p style={{ whiteSpace: 'pre-line', lineHeight: '1.5', color: 'var(--color-text)' }}>
              {opportunity.description}
            </p>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px' }}>Ocupación de referencia</h3>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {opportunity.occupation.name} ({opportunity.occupation.code})
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--color-secondary)' }}>
              {opportunity.occupation.description}
            </p>
          </div>

          {/* Requirements */}
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>
              Requisitos de entrada ({entryReqs.length})
            </h3>
            {entryReqs.length === 0 ? (
              <p className={styles.subtitle}>No se definieron requisitos de entrada obligatorios.</p>
            ) : (
              <div className={styles.reqList}>
                {entryReqs.map((req) => (
                  <div key={req.id} className={styles.reqItem}>
                    <div className={styles.reqItemHeader}>
                      <span className={styles.reqName}>{req.competency_name}</span>
                      <span className={styles.badge} style={{ background: 'var(--color-surface-hover)' }}>
                        {req.requirement_type === 'ESSENTIAL' ? 'Esencial' : 'Deseable'}
                      </span>
                    </div>
                    <div className={styles.reqDesc}>{req.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {trainableReqs.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>
                Requisitos entrenables en el puesto ({trainableReqs.length})
              </h3>
              <div className={styles.reqList}>
                {trainableReqs.map((req) => (
                  <div key={req.id} className={styles.reqItem}>
                    <div className={styles.reqItemHeader}>
                      <span className={styles.reqName}>{req.competency_name}</span>
                      <span className={styles.badge} style={{ background: 'var(--color-surface-hover)' }}>
                        {req.requirement_type === 'ESSENTIAL' ? 'Esencial' : 'Deseable'} · Entrenable
                      </span>
                    </div>
                    <div className={styles.reqDesc}>{req.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Applications & Profile Match Evaluation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Postulación y Autorización de Candidatura */}
          <div className={styles.detailCard} data-testid="application-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Postulación y Autorización</h3>
              {myApplication?.status === 'ACTIVE' && (
                <span className={styles.badge} style={{ background: 'var(--color-olive)', color: '#fff' }}>
                  ✓ Candidatura Activa
                </span>
              )}
              {myApplication?.status === 'WITHDRAWN' && (
                <span className={styles.badge} style={{ background: 'var(--color-divider)', color: 'var(--color-secondary)' }}>
                  Retirada
                </span>
              )}
            </div>

            {applicationError && (
              <Notice error title="Error en postulación">{applicationError}</Notice>
            )}

            {!hasConfirmedProfile ? (
              <Notice title="Perfil requerido">
                Necesitas confirmar una versión de tu perfil para poder autorizar tu postulación a esta vacante.
              </Notice>
            ) : myApplication?.status === 'ACTIVE' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Notice title="Autorización Concedida">
                  Has consentido compartir tus competencias y evidencias comprobadas de tu perfil oficial confirmado con esta empresa. Tus datos personales y de contacto se mantienen privados.
                </Notice>
                <div style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                  <p style={{ margin: '2px 0' }}><strong>Recibo oficial:</strong> {myApplication.receipt_number}</p>
                  <p style={{ margin: '2px 0' }}><strong>Fecha de consentimiento:</strong> {new Date(myApplication.consent_given_at).toLocaleString()}</p>
                  <p style={{ margin: '4px 0 0', fontStyle: 'italic' }}>Nota: Postularte no descuenta plazas laborales de la vacante.</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  style={{ width: '100%', color: 'var(--color-critical)' }}
                >
                  {withdrawing ? 'Retirando autorización...' : 'Retirar autorización de candidatura'}
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myApplication?.status === 'WITHDRAWN' ? (
                  <Notice title="Candidatura Retirada">
                    Retiraste tu postulación el {myApplication.withdrawn_at ? new Date(myApplication.withdrawn_at).toLocaleDateString() : ''}. La empresa ya no tiene acceso a tus habilidades. Puedes volver a autorizarla cuando desees.
                  </Notice>
                ) : (
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)' }}>
                    Al postularte, autorizas a la empresa a visualizar únicamente tus competencias del catálogo y evidencias de respaldo de tu perfil confirmado.
                  </p>
                )}
                <div style={{ fontSize: '12px', color: 'var(--color-secondary)', background: 'var(--color-surface-subtle)', padding: '10px', borderRadius: '6px' }}>
                  🔒 <strong>Garantía de privacidad:</strong> La empresa no podrá ver tu nombre, foto, sexo, edad ni datos de contacto.
                </div>
                <Button
                  onClick={handleApply}
                  disabled={applying}
                  style={{ width: '100%' }}
                >
                  {applying ? 'Registrando autorización...' : myApplication?.status === 'WITHDRAWN' ? 'Volver a autorizar candidatura' : 'Autorizar candidatura con mi perfil'}
                </Button>
              </div>
            )}
          </div>

          <div className={styles.detailCard}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Evaluación con tu perfil</h3>

            {!hasConfirmedProfile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Notice title="Perfil pendiente de confirmación">
                  Debes confirmar tu perfil oficial para realizar evaluaciones objetivas de compatibilidad frente a las vacantes.
                </Notice>
                <Link to="/perfil/cuenta">
                  <Button style={{ width: '100%' }}>Completar y confirmar mi perfil</Button>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)' }}>
                  Compara tus competencias confirmadas y límites logísticos frente a los requerimientos de esta vacante mediante el motor C01.
                </p>

                <Field
                  id="commute-minutes-input"
                  label="Tiempo estimado de traslado de ida (minutos)"
                  type="number"
                  min={0}
                  max={240}
                  value={commuteMinutes}
                  onChange={(e) => setCommuteMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  help="Introduce los minutos que te tomaría desplazarte hacia el lugar de trabajo."
                />

                {comparisonError && <Notice error>{comparisonError}</Notice>}

                <Button
                  onClick={handleRunComparison}
                  disabled={comparing}
                  style={{ width: '100%' }}
                >
                  {comparing ? 'Calculando compatibilidad C01...' : 'Comparar con mi perfil confirmado'}
                </Button>
              </div>
            )}
          </div>

          {comparison && (
            <ComparisonResultsCard
              comparison={comparison}
              onRefresh={handleRunComparison}
              onRequestExplanation={handleRequestExplanation}
              loadingExplanation={loadingExplanation}
            />
          )}

          {explanationError && (
            <Notice error title="Error del orientador">{explanationError}</Notice>
          )}

          {explanation && (
            <div className={styles.comparisonCard} data-testid="explanation-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={styles.badge} style={{ background: 'var(--color-olive)', color: '#fff' }}>
                  Orientación personalizada A03
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                  Gemini 3.8 Flash (Vertex AI)
                </span>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '16px' }}>Explicación clara</h4>
                <p style={{ margin: 0, lineHeight: 1.5, fontSize: '14px' }}>
                  {explanation.summary}
                </p>
              </div>

              {explanation.decision.reasons.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '16px' }}>Motivos y contexto del orientador</h4>
                  <ul className={styles.reasonList}>
                    {explanation.decision.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {explanation.questions.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '16px' }}>Preguntas para aclarar brechas</h4>
                  <ul className={styles.reasonList}>
                    {explanation.questions.map((q, i) => (
                      <li key={i}><strong>{q.field}:</strong> {q.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
