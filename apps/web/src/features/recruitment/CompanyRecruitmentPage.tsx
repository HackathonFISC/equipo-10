import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router';
import type { EmployerApplicationItemView } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from './recruitment.module.css';

interface OrgOpportunity {
  id: string;
  title: string;
  location: string;
  available_slots: number;
  published_at: string;
  applications_count: number;
}

export function CompanyRecruitmentPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { session, me } = useSession();
  const authorized = me?.contexts.some(c => c.organization.id === orgId && c.organization.type === 'COMPANY' && ['RECRUITER', 'ADMIN'].includes(c.role));
  const applicationRequest = useRef(0);

  const [opportunities, setOpportunities] = useState<OrgOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected opportunity for viewing applications
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [applications, setApplications] = useState<EmployerApplicationItemView[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);

  const loadOpportunities = useCallback(async () => {
    if (!session?.access_token || !orgId || !authorized) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchData<{ items: OrgOpportunity[] }>(
        `/organizations/${orgId}/opportunities`,
        session.access_token
      );
      setOpportunities(res.items || []);
    } catch (err: any) {
      setError(err.message || 'No se pudieron cargar las vacantes de la empresa.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, orgId, authorized]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const handleSelectOpportunity = async (oppId: string) => {
    if (!session?.access_token || !orgId || !authorized) return;
    const request = ++applicationRequest.current;
    try {
      setApplications([]);
      setSelectedOppId(oppId);
      setLoadingApps(true);
      setAppsError(null);
      const res = await fetchData<{ items: EmployerApplicationItemView[] }>(
        `/organizations/${orgId}/opportunities/${oppId}/applications`,
        session.access_token
      );
      if (request === applicationRequest.current) setApplications(res.items || []);
    } catch (err: any) {
      if (request === applicationRequest.current) setAppsError(err.message || 'No se pudieron cargar las candidaturas consentidas.');
    } finally {
      if (request === applicationRequest.current) setLoadingApps(false);
    }
  };

  if (!authorized) return <Notice title="Acceso de empresa">Necesitas permisos de reclutador o administrador en esta empresa.</Notice>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestión de Vacantes y Candidaturas</h1>
          <p className={styles.subtitle}>
            Publica puestos con orientación del Agente A01 y revisa habilidades de candidatos con consentimiento explícito.
          </p>
        </div>
        <Link to={`/organizaciones/${orgId}/vacantes/nueva`}>
          <Button data-testid="new-vacancy-button">+ Describir nueva vacante con A01</Button>
        </Link>
      </div>

      {error && <Notice error title="Error">{error}</Notice>}

      <div className={styles.card}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>Vacantes publicadas ({opportunities.length})</h3>

        {loading ? (
          <p style={{ color: 'var(--color-secondary)' }}>Cargando vacantes...</p>
        ) : opportunities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: 'var(--color-secondary)', margin: '0 0 16px' }}>
              Tu organización aún no ha publicado vacantes.
            </p>
            <Link to={`/organizaciones/${orgId}/vacantes/nueva`}>
              <Button>Crear primera vacante con Agente A01</Button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  borderRadius: 'var(--radius-control)',
                  border: '1px solid var(--color-divider)',
                  backgroundColor: selectedOppId === opp.id ? 'var(--color-surface-hover)' : 'var(--color-surface-subtle)',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px' }}>{opp.title}</h4>
                  <div style={{ fontSize: '13px', color: 'var(--color-secondary)', marginTop: '4px' }}>
                    <span>📍 {opp.location}</span> · <span>👥 {opp.available_slots} plaza{opp.available_slots === 1 ? '' : 's'}</span> · <span>📅 {new Date(opp.published_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant={selectedOppId === opp.id ? 'primary' : 'secondary'}
                    disabled={loadingApps}
                    onClick={() => handleSelectOpportunity(opp.id)}
                    data-testid={`view-apps-button-${opp.id}`}
                  >
                    {selectedOppId === opp.id ? 'Viendo candidaturas' : 'Ver candidaturas'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedOppId && (
        <div className={styles.card} data-testid="employer-candidates-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                Candidaturas consentidas ({applications.length})
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-secondary)' }}>
                🔒 Formato minimizado: sin nombre, foto, sexo ni edad. Exclusivamente habilidades y evidencias autorizadas por el candidato.
              </p>
            </div>
            <Button variant="secondary" onClick={() => { applicationRequest.current++; setSelectedOppId(null); setApplications([]); setLoadingApps(false); }}>Cerrar</Button>
          </div>

          {appsError && <Notice error title="Error de acceso">{appsError}</Notice>}

          {loadingApps ? (
            <p style={{ color: 'var(--color-secondary)' }}>Consultando candidaturas autorizadas...</p>
          ) : applications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-secondary)' }}>
              Aún no hay candidatos que hayan autorizado su postulación a esta vacante.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {applications.map((app, index) => (
                <div key={app.id} className={styles.candidateCard} data-testid="candidate-application-item">
                  <div className={styles.candidateHeader}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '16px' }}>Candidato #{index + 1}</span>
                      <span style={{ fontSize: '13px', color: 'var(--color-secondary)', marginLeft: '10px' }}>
                        ID anónimo: <code>{app.candidate_anonymized_id}</code>
                      </span>
                    </div>
                    <div>
                      <span className={`${styles.badge} ${app.status === 'ACTIVE' ? styles.badgeSuccess : styles.badgeDanger}`}>
                        {app.status === 'ACTIVE' ? 'Consentimiento Activo' : 'Candidatura Retirada'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                      Autorización concedida el: {new Date(app.consent_given_at).toLocaleString()}
                    </span>
                  </div>

                  {app.status === 'ACTIVE' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p>Factibilidad: {app.feasibility === 'VIABLE' ? 'Viable según los datos disponibles' : app.feasibility === 'INVIABLE' ? 'Condiciones incompatibles' : 'Datos pendientes'} · Cobertura: {app.coverage_percentage == null ? 'Sin datos evaluables' : `${app.coverage_percentage}%`}</p>
                      <div>
                        <h5 style={{ margin: '0 0 6px', fontSize: '14px', color: '#1e5d4c' }}>
                          ✓ Competencias que coinciden con la vacante ({app.skills.length}):
                        </h5>
                        {app.skills.length === 0 ? (
                          <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>Sin coincidencias directas registradas.</span>
                        ) : (
                          <div className={styles.skillsList}>
                            {app.skills.map((s) => (
                              <span key={s.competency_id} className={styles.skillChip}>
                                {s.competency_name} ({s.status.toLowerCase()}{s.evidence_summary ? ` · ${s.evidence_summary}` : ''})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h5 style={{ margin: '0 0 6px', fontSize: '14px', color: '#b91c1c' }}>
                          Brechas y datos por comprobar ({app.gaps.filter(g=>g.status!=='CUMPLE').length}):
                        </h5>
                        {app.gaps.filter(g=>g.status!=='CUMPLE').length === 0 ? (
                          <span style={{ fontSize: '13px', color: '#1e5d4c', fontWeight: 500 }}>
                            No hay brechas registradas en este resultado. Revisa la cobertura y los datos desconocidos.
                          </span>
                        ) : (
                          <div className={styles.skillsList}>
                            {app.gaps.filter(g=>g.status!=='CUMPLE').map((g) => (
                              <span key={g.competency_id} className={styles.gapChip}>
                                {g.competency_name} ({g.status === 'DESCONOCIDO' ? 'Por comprobar' : 'No cumple'} · {g.requirement_type === 'ESSENTIAL' ? 'Esencial' : 'Deseable'} · {g.stage === 'TRAINABLE' ? 'Entrenable' : 'Entrada'})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Notice title="Acceso Revocado">
                      El candidato retiró voluntariamente su postulación. Conforme a las políticas RLS y de protección de datos, sus competencias y evidencias ya no están disponibles para consulta.
                    </Notice>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
