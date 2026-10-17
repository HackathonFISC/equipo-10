import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router';
import type {
  LearningPlanView,
  LearningPlanExplanationView,
  PlanFeasibility,
  CounselorSummaryView,
  OrientationEngagementView,
} from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from './learning-route.module.css';

export function LearningRoutePage() {
  const { session } = useSession();
  const [searchParams] = useSearchParams();
  const oppIdParam = searchParams.get('opportunity_id');

  const [plans, setPlans] = useState<LearningPlanView[]>([]);
  const [activePlan, setActivePlan] = useState<LearningPlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Form states
  const [commuteMinutes, setCommuteMinutes] = useState<number>(30);
  const [maxBudget, setMaxBudget] = useState<string>('');
  const [consentA05, setConsentA05] = useState(true);
  const [explanation, setExplanation] = useState<LearningPlanExplanationView | null>(null);

  // D8 Orientation states
  const [counselors, setCounselors] = useState<CounselorSummaryView[]>([]);
  const [engagements, setEngagements] = useState<OrientationEngagementView[]>([]);
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>('');
  const [orientationPurpose, setOrientationPurpose] = useState<string>('');
  const [orientationConsent, setOrientationConsent] = useState(false);
  const [requestingOrientation, setRequestingOrientation] = useState(false);
  const [revokingEngagement, setRevokingEngagement] = useState(false);
  const [clarificationNotes, setClarificationNotes] = useState<Record<string, string>>({});
  const [respondingClarificationId, setRespondingClarificationId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchData<LearningPlanView[]>('/me/learning-plans', session.access_token);
      setPlans(res);
      if (res.length > 0 && !activePlan) {
        setActivePlan(res[0]);
      }
    } catch {
      setError('No se pudieron cargar los planes formativos.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  const loadOrientationData = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const [counselorsRes, engagementsRes] = await Promise.all([
        fetchData<CounselorSummaryView[]>('/counselors', session.access_token).catch(() => []),
        fetchData<OrientationEngagementView[]>('/me/orientations', session.access_token).catch(() => []),
      ]);
      setCounselors(counselorsRes);
      setEngagements(engagementsRes);
      if (counselorsRes.length > 0 && !selectedCounselorId) {
        setSelectedCounselorId(counselorsRes[0].id);
      }
    } catch {
      // no crítico si no hay orientadores
    }
  }, [session?.access_token, selectedCounselorId]);

  useEffect(() => {
    loadPlans();
    loadOrientationData();
  }, [loadPlans, loadOrientationData]);

  const handleRequestOrientation = async () => {
    if (!session?.access_token || !activePlan) return;
    if (!selectedCounselorId) {
      setError('Debes seleccionar un orientador disponible.');
      return;
    }
    if (!orientationConsent) {
      setError('Debes otorgar tu consentimiento explícito para compartir la versión de tu ruta con el orientador.');
      return;
    }

    try {
      setRequestingOrientation(true);
      setError(null);
      const idempotencyKey = `ori-req-${activePlan.id}-${Date.now()}`;
      const res = await fetchData<OrientationEngagementView>(
        `/me/learning-plans/${activePlan.id}/orientation`,
        session.access_token,
        'POST',
        {
          counselor_id: selectedCounselorId,
          purpose: orientationPurpose.trim() || undefined,
        },
        undefined,
        { 'Idempotency-Key': idempotencyKey }
      );
      setEngagements((prev) => [res, ...prev.filter((e) => e.id !== res.id)]);
      setNoticeMessage(`¡Solicitud de acompañamiento registrada! Recibo: ${res.receipt_number}. Tu orientador ha sido notificado.`);
      setOrientationPurpose('');
    } catch (err: any) {
      setError(err?.message || 'Error al solicitar acompañamiento del orientador.');
    } finally {
      setRequestingOrientation(false);
    }
  };

  const handleRevokeOrientation = async (engagementId: string) => {
    if (!session?.access_token) return;
    const confirmed = window.confirm(
      '¿Deseas dejar de compartir tu ruta con el orientador? El orientador perderá acceso de inmediato. Tus reservas previamente confirmadas no se verán afectadas.'
    );
    if (!confirmed) return;

    try {
      setRevokingEngagement(true);
      setError(null);
      const res = await fetchData<OrientationEngagementView>(
        `/me/orientations/${engagementId}/revoke`,
        session.access_token,
        'POST',
        { reason: 'Revocado por decisión del candidato' }
      );
      setEngagements((prev) => prev.map((e) => (e.id === res.id ? res : e)));
      setNoticeMessage('Acompañamiento revocado. El orientador ya no tiene acceso a tu ruta ni a tus datos.');
    } catch (err: any) {
      setError(err?.message || 'Error al revocar el acompañamiento.');
    } finally {
      setRevokingEngagement(false);
    }
  };

  const handleRespondClarification = async (
    engagementId: string,
    clarificationId: string,
    decision: 'ACCEPTED' | 'REJECTED'
  ) => {
    if (!session?.access_token) return;
    try {
      setRespondingClarificationId(clarificationId);
      setError(null);
      const responseText = clarificationNotes[clarificationId] || undefined;
      await fetchData(
        `/me/orientations/${engagementId}/clarifications/${clarificationId}/response`,
        session.access_token,
        'POST',
        {
          decision,
          response: responseText,
        }
      );
      setNoticeMessage(
        decision === 'ACCEPTED'
          ? 'Has aceptado la propuesta del orientador. Se ha registrado tu confirmación.'
          : 'Has declinado la sugerencia del orientador manteniendo tu plan original.'
      );
      await loadOrientationData();
    } catch (err: any) {
      setError(err?.message || 'Error al responder la aclaración.');
    } finally {
      setRespondingClarificationId(null);
    }
  };

  const handleCalculateRoute = async () => {
    if (!session?.access_token) return;
    try {
      setCalculating(true);
      setError(null);
      setNoticeMessage(null);
      setExplanation(null);

      const idempotencyKey = `plan-preview-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload: any = {
        target_opportunity_id: oppIdParam || undefined,
        assumptions: {
          commute_minutes: Number(commuteMinutes) || 0,
          max_budget_amount: maxBudget ? maxBudget : undefined,
        },
      };

      const res = await fetchData<LearningPlanView>(
        '/me/learning-plans/preview',
        session.access_token,
        'POST',
        payload,
        undefined,
        { 'Idempotency-Key': idempotencyKey }
      );

      setActivePlan(res);
      setPlans((prev) => [res, ...prev.filter((p) => p.id !== res.id)]);
      setNoticeMessage('Nueva ruta formativa calculada exitosamente con el motor determinista C01.');
    } catch (err: any) {
      setError(err?.message || 'Error al calcular la ruta formativa.');
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirmPlan = async () => {
    if (!session?.access_token || !activePlan) return;
    try {
      setConfirming(true);
      setError(null);

      const res = await fetchData<LearningPlanView>(
        `/me/learning-plans/${activePlan.id}/confirmations`,
        session.access_token,
        'POST'
      );

      setActivePlan(res);
      setPlans((prev) => prev.map((p) => (p.id === res.id ? res : p)));
      setNoticeMessage('¡Plan formativo confirmado! Recuerda que para asegurar tu lugar debes reservar tu plaza en cada edición.');
    } catch (err: any) {
      setError(err?.message || 'Error al confirmar el plan formativo.');
    } finally {
      setConfirming(false);
    }
  };

  const handleExplainPlan = async () => {
    if (!session?.access_token || !activePlan) return;
    if (!consentA05) {
      setError('Debes autorizar el consentimiento para consultar al orientador A05.');
      return;
    }
    try {
      setExplaining(true);
      setError(null);

      const res = await fetchData<LearningPlanExplanationView>(
        `/me/learning-plans/${activePlan.id}/explanations`,
        session.access_token,
        'POST',
        { consent: true }
      );

      setExplanation(res);
    } catch (err: any) {
      setError(err?.message || 'Error al solicitar orientación con Agente A05.');
    } finally {
      setExplaining(false);
    }
  };

  const getFeasibilityBadge = (feasibility: PlanFeasibility) => {
    switch (feasibility) {
      case 'VIABLE':
        return <span className={`${styles.badge} ${styles.badgeViable}`}>Ruta viable</span>;
      case 'CONDITIONAL':
        return <span className={`${styles.badge} ${styles.badgeConditional}`}>Ruta condicional</span>;
      case 'PENDING':
        return <span className={`${styles.badge} ${styles.badgePending}`}>Pendiente de datos</span>;
      case 'INVIABLE':
        return <span className={`${styles.badge} ${styles.badgeInviable}`}>Inviable</span>;
      default:
        return <span className={styles.badge}>{feasibility}</span>;
    }
  };

  const currentEngagement = activePlan
    ? engagements.find((e) => e.plan_id === activePlan.id && e.status !== 'REVOKED')
    : undefined;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist" aria-label="Secciones de itinerario">
          <button type="button" className={`${styles.tab} ${styles.tabActive}`} role="tab" aria-selected="true">
            🗺️ Mi Ruta Formativa
          </button>
          <Link to="/agenda" className={styles.tab} role="tab" aria-selected="false">
            📅 Mi Agenda y Clases
          </Link>
        </div>
        <h1 className={styles.title}>Mi ruta formativa</h1>
        <p className={styles.subtitle}>
          Diseña, compara y consolida itinerarios de capacitación para cerrar tus brechas de competencias y alcanzar tu meta laboral.
        </p>
      </div>

      {noticeMessage && (
        <Notice title="Actualización de plan">
          {noticeMessage}
        </Notice>
      )}

      {error && (
        <Notice error title="Atención">
          {error}
        </Notice>
      )}

      {/* Panel de cálculo C01 */}
      <div className={styles.card}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>Calcular nueva ruta formativa</h2>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)' }}>
          {oppIdParam
            ? `Meta vinculada: Oportunidad laboral (${oppIdParam})`
            : 'El motor evaluará tus competencias confirmadas frente a la oferta de cursos disponible en los próximos 30 días.'}
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label htmlFor="commuteInput" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Minutos de traslado estimados:
            </label>
            <input
              id="commuteInput"
              type="number"
              min={0}
              max={180}
              value={commuteMinutes}
              onChange={(e) => setCommuteMinutes(parseInt(e.target.value, 10) || 0)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-subtle)',
              }}
            />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label htmlFor="budgetInput" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Presupuesto máximo disponible (USD):
            </label>
            <input
              id="budgetInput"
              type="number"
              min={0}
              step="0.01"
              placeholder="Opcional (ej. 50.00)"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-subtle)',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleCalculateRoute} disabled={calculating}>
            {calculating ? 'Calculando combinaciones...' : 'Calcular ruta formativa C01'}
          </Button>
        </div>
      </div>

      {/* Plan Activo */}
      {activePlan && (
        <div className={styles.card} data-testid="active-learning-plan-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                Estado: <strong>{activePlan.status}</strong> • v{activePlan.version}
              </span>
              <h2 style={{ margin: '4px 0 0', fontSize: '22px' }}>Itinerario formativo seleccionado</h2>
            </div>
            {getFeasibilityBadge(activePlan.feasibility)}
          </div>

          {activePlan.outdated && (
            <div className={styles.calloutWarning} role="alert">
              Tu perfil o las condiciones de las ediciones han cambiado desde el cálculo de este plan. Por favor recalcula la ruta.
            </div>
          )}

          {/* Barra de cobertura */}
          <div className={styles.coverageSection}>
            <div className={styles.coverageStats}>
              <span>Cobertura de competencias de la meta:</span>
              <span>
                {activePlan.coverage_numerator} de {activePlan.coverage_denominator} competencias cubiertas
              </span>
            </div>
            <div className={styles.coverageBar}>
              <div
                className={styles.coverageBarFill}
                style={{
                  width: `${activePlan.coverage_denominator > 0 ? (activePlan.coverage_numerator / activePlan.coverage_denominator) * 100 : 0}%`,
                  backgroundColor: activePlan.feasibility === 'VIABLE' ? '#10b981' : '#f59e0b',
                }}
              />
            </div>
          </div>

          {/* Brechas residuales */}
          {activePlan.residual_gap.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
              <strong>Brechas residuales pendientes:</strong> {activePlan.residual_gap.join(', ')}
            </div>
          )}

          {/* Razones C01 */}
          <div>
            <h3 style={{ fontSize: '15px', margin: '0 0 8px' }}>Fundamentos objetivos del motor C01:</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {activePlan.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          {/* Pasos formativos */}
          <div>
            <h3 style={{ fontSize: '16px', margin: '0 0 12px' }}>
              Etapas y cursos del plan ({activePlan.steps.length}):
            </h3>
            {activePlan.steps.length === 0 ? (
              <p style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>
                Sin cursos programados en esta ruta.
              </p>
            ) : (
              <ul className={styles.stepsTimeline}>
                {activePlan.steps.map((step) => (
                  <li key={step.id || step.step_order} className={styles.stepItem} data-testid={`plan-step-${step.step_order}`}>
                    <div className={styles.stepHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={styles.stepNumber}>{step.step_order}</span>
                        <strong style={{ fontSize: '16px' }}>{step.course_title}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className={`${styles.badge} ${step.step_type === 'DIRECT' ? styles.badgeViable : styles.badgeConditional}`}>
                          {step.step_type === 'DIRECT' ? 'Paso Directo' : 'Condicional'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>
                          ${step.cost_amount || '0.00'} {step.currency || 'USD'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.stepMeta}>
                      <span>⏱️ {step.schedule_summary}</span>
                    </div>

                    {step.conditional_prerequisite_description && (
                      <div style={{ fontSize: '13px', color: '#92400e', backgroundColor: '#fffbeb', padding: '8px 12px', borderRadius: 'var(--radius-control)' }}>
                        ⚠️ {step.conditional_prerequisite_description}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                      <Link to={`/mi-ruta/reservar?edition_id=${step.edition_id}${currentEngagement?.status === 'APPROVED' ? `&plan_id=${activePlan.id}` : ''}`}>
                        <Button variant="secondary">
                          {currentEngagement?.status === 'APPROVED' ? 'Reservar plaza acompañada →' : 'Reservar esta plaza →'}
                        </Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ============================================================== */}
          {/* D8: Acompañamiento de Orientador Independiente                 */}
          {/* ============================================================== */}
          <div className={styles.card} data-testid="counselor-accompaniment-card" style={{ borderLeft: '4px solid var(--color-primary, #2563eb)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>
                  🧑‍🏫 Acompañamiento de Orientador Independiente
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-secondary)' }}>
                  Revisión humana e imparcial de la ruta v{activePlan.version}. El orientador no representa a empresas ni a centros formativos.
                </p>
              </div>
              {currentEngagement && (
                <span className={`${styles.badge} ${
                  currentEngagement.status === 'APPROVED' ? styles.badgeViable :
                  currentEngagement.status === 'REJECTED' ? styles.badgeInviable :
                  currentEngagement.status === 'CLARIFICATION_REQUESTED' ? styles.badgeConditional :
                  styles.badgePending
                }`}>
                  {currentEngagement.status === 'APPROVED' ? 'Acompañamiento Aprobado' :
                   currentEngagement.status === 'REJECTED' ? 'Con Observaciones' :
                   currentEngagement.status === 'CLARIFICATION_REQUESTED' ? 'Aclaración Solicitada' :
                   currentEngagement.status === 'IN_REVIEW' ? 'En Revisión' :
                   currentEngagement.status === 'OUTDATED' ? 'Ruta Desactualizada' : 'Solicitado'}
                </span>
              )}
            </div>

            {currentEngagement ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '13px', background: 'var(--color-surface-subtle)', padding: '10px 14px', borderRadius: '6px' }}>
                  <span>Orientador asignado: <strong>{currentEngagement.counselor.display_name}</strong></span>
                  <span>Recibo de solicitud: <code>{currentEngagement.receipt_number}</code></span>
                  <span>Fecha: {new Date(currentEngagement.requested_at).toLocaleDateString()}</span>
                </div>

                {/* Revisiones */}
                {currentEngagement.reviews && currentEngagement.reviews.length > 0 && (
                  <div style={{ background: currentEngagement.status === 'APPROVED' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${currentEngagement.status === 'APPROVED' ? '#a7f3d0' : '#fecaca'}`, borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: currentEngagement.status === 'APPROVED' ? '#065f46' : '#991b1b' }}>
                      Dictamen del orientador ({currentEngagement.reviews[0].decision}):
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--color-text)' }}>
                      "{currentEngagement.reviews[0].motivation}"
                    </p>
                    {currentEngagement.reviews[0].reasons.length > 0 && (
                      <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '13px' }}>
                        {currentEngagement.reviews[0].reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Aclaraciones */}
                {currentEngagement.clarifications && currentEngagement.clarifications.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4 style={{ margin: '4px 0 0', fontSize: '14px' }}>Aclaraciones del orientador:</h4>
                    {currentEngagement.clarifications.map((item) => (
                      <div key={item.id} style={{ background: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px' }}>
                        <p style={{ margin: 0, fontSize: '14px' }}>
                          <strong>Pregunta:</strong> {item.question}
                        </p>
                        {item.proposed_correction && (
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-primary)' }}>
                            💡 Sugerencia: {item.proposed_correction}
                          </p>
                        )}

                        {item.youth_decision === 'PENDING' ? (
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="Nota o respuesta adicional (opcional)"
                              value={clarificationNotes[item.id] || ''}
                              onChange={(e) => setClarificationNotes({ ...clarificationNotes, [item.id]: e.target.value })}
                              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <Button
                                variant="secondary"
                                style={{ fontSize: '13px', padding: '4px 10px' }}
                                disabled={respondingClarificationId === item.id}
                                onClick={() => handleRespondClarification(currentEngagement.id, item.id, 'ACCEPTED')}
                              >
                                {respondingClarificationId === item.id ? 'Guardando...' : 'Aceptar sugerencia'}
                              </Button>
                              <Button
                                variant="text"
                                style={{ fontSize: '13px', padding: '4px 10px', color: 'var(--color-secondary)' }}
                                disabled={respondingClarificationId === item.id}
                                onClick={() => handleRespondClarification(currentEngagement.id, item.id, 'REJECTED')}
                              >
                                Mantener mi ruta original
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-secondary)' }}>
                            Respuesta: <strong>{item.youth_decision === 'ACCEPTED' ? 'Aceptada' : 'Declinada'}</strong>
                            {item.youth_response && ` ("${item.youth_response}")`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Botón Revocar Acompañamiento */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <Button
                    variant="text"
                    style={{ color: '#b91c1c', fontSize: '13px' }}
                    disabled={revokingEngagement}
                    onClick={() => handleRevokeOrientation(currentEngagement.id)}
                  >
                    {revokingEngagement ? 'Revocando...' : 'Dejar de compartir con el orientador (Revocar)'}
                  </Button>
                </div>
              </div>
            ) : (
              /* Formulario para pedir orientador */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)' }}>
                  Puedes invitar a un orientador habilitado a revisar esta ruta formativa v{activePlan.version}. Tendrá acceso exclusivo y temporal a los pasos y presupuestos calculados sin poder modificar tus datos personales ni reservar por ti.
                </p>

                {counselors.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-secondary)', fontStyle: 'italic' }}>
                    No hay orientadores disponibles en el sistema actualmente.
                  </p>
                ) : (
                  <>
                    <div>
                      <label htmlFor="counselorSelect" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                        Selecciona un orientador habilitado:
                      </label>
                      <select
                        id="counselorSelect"
                        value={selectedCounselorId}
                        onChange={(e) => setSelectedCounselorId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-control)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-surface-subtle)',
                          fontSize: '14px',
                        }}
                      >
                        {counselors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.display_name} {c.headline ? `— ${c.headline}` : ''} ({c.specialties.join(', ')})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="orientationPurpose" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                        Duda o inquietud específica (opcional):
                      </label>
                      <input
                        id="orientationPurpose"
                        type="text"
                        placeholder="Ejemplo: ¿Es conveniente tomar primero el curso de inventarios o bodega?"
                        value={orientationPurpose}
                        onChange={(e) => setOrientationPurpose(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-control)',
                          border: '1px solid var(--color-border)',
                          fontSize: '14px',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <input
                        id="orientationConsentCheck"
                        type="checkbox"
                        checked={orientationConsent}
                        onChange={(e) => setOrientationConsent(e.target.checked)}
                        style={{ marginTop: '3px' }}
                      />
                      <label htmlFor="orientationConsentCheck" style={{ fontSize: '13px', color: 'var(--color-secondary)', lineHeight: 1.4 }}>
                        Autorizo expresamente compartir con este orientador independiente la versión seleccionada de mi ruta formativa y los datos mínimos de mi perfil. Comprendo que el orientador no pertenece a empresas ni centros y que puedo revocar este acceso en cualquier momento.
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        onClick={handleRequestOrientation}
                        disabled={requestingOrientation || !orientationConsent || !selectedCounselorId}
                      >
                        {requestingOrientation ? 'Enviando solicitud...' : 'Solicitar acompañamiento al orientador'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ADVERTENCIA CRUCIAL DE NEGOCIO */}
          <div className={styles.calloutWarning}>
            <strong>⚠️ Recordatorio de matriculación:</strong> Confirmar este plan formativo guarda tu itinerario formativo preferido, pero <strong>NO reserva ni descuenta plazas</strong> en los cursos. La reserva de plaza de cada edición se realiza de forma individual y segura con confirmación separada.
          </div>

          {/* Acciones principales del plan */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="consentCheck"
                type="checkbox"
                checked={consentA05}
                onChange={(e) => setConsentA05(e.target.checked)}
              />
              <label htmlFor="consentCheck" style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                Autorizo orientación inteligente de A05
              </label>
              <Button variant="secondary" onClick={handleExplainPlan} disabled={explaining || !consentA05}>
                {explaining ? 'Orientador analizando...' : 'Consultar con orientador A05'}
              </Button>
            </div>

            {activePlan.status !== 'CONFIRMED' && (
              <Button onClick={handleConfirmPlan} disabled={confirming || activePlan.outdated}>
                {confirming ? 'Confirmando...' : 'Confirmar plan formativo'}
              </Button>
            )}
          </div>

          {/* Explicación A05 si fue solicitada */}
          {explanation && (
            <div className={styles.explanationBox} data-testid="a05-explanation-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  🤖 Orientación del Agente A05 (Gemini 3.8 Flash)
                </h3>
                <span className={`${styles.badge} ${styles.badgeMode}`}>v{explanation.contract_version}</span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text)' }}>
                {explanation.summary}
              </p>
              {explanation.decision.reasons.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--color-secondary)' }}>
                  {explanation.decision.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
