import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import type { CounselorEngagementDetailView } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from './counselor.module.css';

export function CounselorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();

  const [detail, setDetail] = useState<CounselorEngagementDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Clarification form
  const [showClarificationForm, setShowClarificationForm] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [proposedCorrection, setProposedCorrection] = useState('');
  const [sendingClarification, setSendingClarification] = useState(false);

  // Review form
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [motivation, setMotivation] = useState('');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([
    'Cumplimiento de prerrequisitos',
    'Compatibilidad horaria y logística',
  ]);
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!session?.access_token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchData<CounselorEngagementDetailView>(
        `/counselor/engagements/${id}`,
        session.access_token
      );
      setDetail(res);
      // Si la ruta es inviable, cambiar selección a REJECTED por defecto
      if (res.plan.feasibility === 'INVIABLE') {
        setDecision('REJECTED');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el caso de acompañamiento.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleSendClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !id) return;
    if (questionText.trim().length < 5) {
      setError('La pregunta de aclaración debe tener al menos 5 caracteres.');
      return;
    }

    try {
      setSendingClarification(true);
      setError(null);
      await fetchData(
        `/counselor/engagements/${id}/clarifications`,
        session.access_token,
        'POST',
        {
          question: questionText.trim(),
          proposed_correction: proposedCorrection.trim() || undefined,
        }
      );
      setQuestionText('');
      setProposedCorrection('');
      setShowClarificationForm(false);
      setNotice('Aclaración enviada con éxito al joven.');
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Error al enviar la solicitud de aclaración.');
    } finally {
      setSendingClarification(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !id || !detail) return;
    if (motivation.trim().length < 5) {
      setError('El dictamen motivado debe contener al menos 5 caracteres explicando tu decisión.');
      return;
    }

    try {
      setSubmittingReview(true);
      setError(null);
      await fetchData(
        `/counselor/engagements/${id}/review`,
        session.access_token,
        'POST',
        {
          expected_plan_version: detail.plan.version,
          decision,
          motivation: motivation.trim(),
          reasons: selectedReasons,
        }
      );
      setNotice(`Dictamen (${decision === 'APPROVED' ? 'APROBADO' : 'RECHAZADO'}) registrado correctamente.`);
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar el dictamen motivado.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const toggleReason = (r: string) => {
    if (selectedReasons.includes(r)) {
      setSelectedReasons(selectedReasons.filter((item) => item !== r));
    } else {
      setSelectedReasons([...selectedReasons, r]);
    }
  };

  if (loading && !detail) {
    return (
      <div className={styles.container}>
        <p>Cargando información autorizada del caso...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={styles.container}>
        <Notice error title="Caso no accesible">
          {error || 'No se pudo acceder a la solicitud de acompañamiento. Puede haber sido revocada.'}
        </Notice>
        <Link to="/orientador/bandeja">
          <Button variant="secondary">← Volver a mi bandeja</Button>
        </Link>
      </div>
    );
  }

  const isInviable = detail.plan.feasibility === 'INVIABLE';
  const isOutdated = detail.engagement.status === 'OUTDATED';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/orientador/bandeja" style={{ fontSize: '14px', textDecoration: 'none', color: 'var(--color-primary)' }}>
            ← Volver a la bandeja
          </Link>
          <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
            Recibo: <strong>{detail.engagement.receipt_number}</strong>
          </span>
        </div>
        <h1 className={styles.title}>Caso: {detail.candidate_summary.display_name}</h1>
        <p className={styles.subtitle}>
          Acompañamiento vocacional para la ruta formativa v{detail.engagement.plan_version}
          {detail.target_opportunity ? ` • Meta: ${detail.target_opportunity.title}` : ''}
        </p>
      </div>

      {notice && <Notice title="Actualización">{notice}</Notice>}
      {error && <Notice error title="Error">{error}</Notice>}

      {isOutdated && (
        <div className={styles.inviableAlert} role="alert">
          <span>⚠️</span>
          <div>
            <strong>Ruta desactualizada:</strong> El joven ha modificado o recalculado su ruta posterior a esta solicitud. Cualquier dictamen debe esperar a la versión vigente.
          </div>
        </div>
      )}

      {/* Resumen del Candidato (Minimizado, sin datos privados ni CV crudo) */}
      <div className={styles.card}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>👤 Perfil del Candidato (Datos Autorizados)</h2>
        <div className={styles.grid2}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Nombre o Identificador</span>
            <span className={styles.statValue}>{detail.candidate_summary.display_name}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Titular Vocacional</span>
            <span className={styles.statValue}>{detail.candidate_summary.headline || 'No especificado'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Límite de Traslado</span>
            <span className={styles.statValue}>
              {detail.candidate_summary.max_commute_minutes !== null
                ? `Máximo ${detail.candidate_summary.max_commute_minutes} minutos`
                : 'Sin restricción'}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Presupuesto de Capacitación</span>
            <span className={styles.statValue}>
              {detail.candidate_summary.training_budget
                ? `$${detail.candidate_summary.training_budget} USD`
                : 'Sin límite establecido'}
            </span>
          </div>
        </div>
        {detail.engagement.purpose && (
          <div style={{ marginTop: '8px', padding: '12px', background: 'var(--color-surface-subtle)', borderRadius: '8px' }}>
            <strong>Mensaje / Duda del joven:</strong>
            <p style={{ margin: '4px 0 0', fontStyle: 'italic', fontSize: '14px' }}>"{detail.engagement.purpose}"</p>
          </div>
        )}
      </div>

      {/* Detalle de la Ruta Formativa C01 */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>🗺️ Itinerario Formativo Evaluado por C01</h2>
            <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
              Versión {detail.plan.version} • Factibilidad determinista: <strong>{detail.plan.feasibility}</strong>
            </span>
          </div>
          <div>
            <span className={`${styles.badge} ${isInviable ? styles.badgeRejected : styles.badgeApproved}`}>
              {detail.plan.feasibility}
            </span>
          </div>
        </div>

        {isInviable && (
          <div className={styles.inviableAlert} role="alert">
            <span>🚫</span>
            <div>
              <strong>Regla Determinista C01:</strong> Esta ruta presenta colisiones objetivas, incompatibilidades horarias o falta de prerrequisitos. Según las reglas de negocio, un orientador <strong>no puede aprobar un plan INVIABLE</strong>. Debes solicitar aclaraciones o emitir un rechazo fundado.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px' }}>
          <div>
            <strong>Cobertura de Competencias:</strong> {detail.plan.coverage_numerator} de {detail.plan.coverage_denominator}
          </div>
          <div>
            <strong>Costo Total Estimado:</strong> ${detail.plan.total_cost_amount || '0.00'} {detail.plan.currency || 'USD'}
          </div>
        </div>

        {detail.plan.residual_gap.length > 0 && (
          <div style={{ fontSize: '14px', color: '#b91c1c' }}>
            <strong>Brechas pendientes sin cobertura:</strong> {detail.plan.residual_gap.join(', ')}
          </div>
        )}

        {/* Etapas formativas */}
        <div>
          <h3 style={{ margin: '8px 0', fontSize: '15px' }}>Etapas y cursos del itinerario:</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {detail.plan.steps.map((step) => (
              <li
                key={step.id || step.step_order}
                style={{
                  padding: '12px 16px',
                  background: 'var(--color-surface-subtle)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <strong>Paso {step.step_order}: {step.course_title}</strong>
                  <div style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                    ⏱️ {step.schedule_summary || 'Horario a confirmar'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`${styles.badge} ${step.step_type === 'DIRECT' ? styles.badgeApproved : styles.badgeReview}`}>
                    {step.step_type}
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    ${step.cost_amount || '0.00'} {step.currency || 'USD'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Aclaraciones y sugerencias al joven */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>💬 Aclaraciones e Intercambio con el Joven</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-secondary)' }}>
              Propón correcciones de horario o aclara dudas antes de emitir tu dictamen final.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setShowClarificationForm(!showClarificationForm)}>
            {showClarificationForm ? 'Cancelar' : '+ Pedir aclaración'}
          </Button>
        </div>

        {showClarificationForm && (
          <form onSubmit={handleSendClarification} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface-subtle)', padding: '16px', borderRadius: '8px' }}>
            <div>
              <label htmlFor="clarifQuestion" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                Pregunta o inquietud para el joven:
              </label>
              <textarea
                id="clarifQuestion"
                rows={3}
                required
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Ejemplo: Notamos que el curso de bodega coincide con tu turno matutino. ¿Podrías cursarlo en modalidad vespertina?"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div>
              <label htmlFor="clarifCorrection" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                Propuesta de ajuste recomendada (opcional):
              </label>
              <input
                id="clarifCorrection"
                type="text"
                value={proposedCorrection}
                onChange={(e) => setProposedCorrection(e.target.value)}
                placeholder="Ejemplo: Cambiar edición al grupo B de los sábados."
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button type="submit" disabled={sendingClarification}>
                {sendingClarification ? 'Enviando...' : 'Enviar al joven'}
              </Button>
            </div>
          </form>
        )}

        {/* Historial de aclaraciones */}
        {detail.engagement.clarifications && detail.engagement.clarifications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {detail.engagement.clarifications.map((item) => (
              <div key={item.id} className={styles.clarificationBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <strong>Pregunta del orientador:</strong>
                  <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px' }}>{item.question}</p>
                {item.proposed_correction && (
                  <div style={{ fontSize: '13px', color: 'var(--color-primary)' }}>
                    💡 Propuesta: {item.proposed_correction}
                  </div>
                )}

                <div className={styles.clarificationResponse}>
                  <strong>Respuesta del joven: </strong>
                  <span className={`${styles.badge} ${item.youth_decision === 'ACCEPTED' ? styles.badgeApproved : item.youth_decision === 'REJECTED' ? styles.badgeRejected : styles.badgeReview}`}>
                    {item.youth_decision === 'PENDING' ? 'Pendiente' : item.youth_decision === 'ACCEPTED' ? 'Aceptada' : 'Declinada'}
                  </span>
                  {item.youth_response && (
                    <p style={{ margin: '6px 0 0', fontStyle: 'italic' }}>"{item.youth_response}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)' }}>
            No hay aclaraciones previas en este caso.
          </p>
        )}
      </div>

      {/* Dictamen Motivado / Revisión del Orientador */}
      <div className={styles.card}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>⚖️ Dictamen y Revisión del Plan</h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-secondary)' }}>
          El orientador emite una revisión vinculante para la versión {detail.plan.version}. Si es aprobada, el joven podrá reservar plazas en modalidad acompañada.
        </p>

        {/* Revisiones previas */}
        {detail.engagement.reviews && detail.engagement.reviews.length > 0 && (
          <div style={{ background: 'var(--color-surface-subtle)', padding: '16px', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '15px' }}>Dictámenes registrados:</h3>
            {detail.engagement.reviews.map((rev) => (
              <div key={rev.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`${styles.badge} ${rev.decision === 'APPROVED' ? styles.badgeApproved : styles.badgeRejected}`}>
                    {rev.decision}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                    Por {rev.counselor_name} el {new Date(rev.reviewed_at).toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '14px' }}>{rev.motivation}</p>
                {rev.reasons.length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--color-secondary)' }}>
                    {rev.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmitReview} className={styles.reviewSection}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Decisión del Dictamen:
            </label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: isInviable ? 'not-allowed' : 'pointer', opacity: isInviable ? 0.5 : 1 }}>
                <input
                  type="radio"
                  name="reviewDecision"
                  value="APPROVED"
                  checked={decision === 'APPROVED'}
                  disabled={isInviable}
                  onChange={() => setDecision('APPROVED')}
                />
                <span style={{ fontWeight: 600, color: '#15803d' }}>Aprobar Plan Formativo</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="reviewDecision"
                  value="REJECTED"
                  checked={decision === 'REJECTED'}
                  onChange={() => setDecision('REJECTED')}
                />
                <span style={{ fontWeight: 600, color: '#b91c1c' }}>Rechazar con Observaciones</span>
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Criterios y fundamentos:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {[
                'Cumplimiento de prerrequisitos',
                'Compatibilidad horaria y logística',
                'Alineación con la oportunidad meta',
                'Carga horaria balanceada para el joven',
                'Disponibilidad de cupos confirmada',
              ].map((reason) => (
                <label key={reason} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={selectedReasons.includes(reason)}
                    onChange={() => toggleReason(reason)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="reviewMotivation" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
              Motivación obligatoria del orientador (mínimo 5 caracteres):
            </label>
            <textarea
              id="reviewMotivation"
              rows={4}
              required
              minLength={5}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="Explica detalladamente por qué este plan formativo es favorable o qué elementos impiden su aprobación..."
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" disabled={submittingReview || isOutdated}>
              {submittingReview ? 'Registrando dictamen...' : 'Registrar dictamen oficial'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
