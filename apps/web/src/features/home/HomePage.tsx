import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from '../../styles/App.module.css';
import { useProfileView, resumeProfilePath } from '../profile/useProfileView';
import type { OpportunityComparisonView, AgendaView, AgendaEventView } from '@equipo10/contracts';

export function HomePage() {
  const navigate = useNavigate();
  const { session, me, reload } = useSession();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    reload: reloadProfile,
    createDraftFromConfirmed,
    creatingDraft,
  } = useProfileView();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdNotice, setCreatedNotice] = useState(false);
  const [recentComparisons, setRecentComparisons] = useState<OpportunityComparisonView[]>([]);
  const [loadingComparisons, setLoadingComparisons] = useState(false);

  const hasConfirmedProfile = Boolean(profile?.current_version_id);
  const hasDraftProfile = Boolean(profile?.active_draft && !profile.current_version_id);

  useEffect(() => {
    if (!session?.access_token || !hasConfirmedProfile) {
      setRecentComparisons([]);
      return;
    }

    let active = true;
    setLoadingComparisons(true);
    fetchData<OpportunityComparisonView[]>('/me/opportunity-comparisons?limit=3', session.access_token)
      .then((res) => {
        if (active && Array.isArray(res)) {
          setRecentComparisons(res);
        }
      })
      .catch(() => {
        // Fallo no crítico en dashboard
      })
      .finally(() => {
        if (active) setLoadingComparisons(false);
      });

    return () => {
      active = false;
    };
  }, [session?.access_token, hasConfirmedProfile]);

  const handleCreateProfile = async () => {
    if (!session?.access_token) return;
    try {
      setPending(true);
      setError(null);
      await fetchData('/me/candidate-profile', session.access_token, 'PUT', {});
      setCreatedNotice(true);
      reload();
    } catch {
      setError('No se pudo crear el espacio privado. Reintente.');
    } finally {
      setPending(false);
    }
  };

  const handleStartEdit = async (targetPath = '/perfil/trayectoria') => {
    if (!profile?.current_version_id) return;
    try {
      await createDraftFromConfirmed(profile.current_version_id);
      navigate(targetPath);
    } catch {
      setError('No se pudo iniciar la edición del perfil.');
    }
  };

  const [agendaEvents, setAgendaEvents] = useState<AgendaEventView[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);

  useEffect(() => {
    if (!session?.access_token) {
      setAgendaEvents([]);
      return;
    }
    let active = true;
    setLoadingAgenda(true);
    fetchData<AgendaView>('/me/agenda', session.access_token)
      .then((res) => {
        if (active && res && Array.isArray(res.events)) {
          setAgendaEvents(res.events.filter((e) => e.status === 'CONFIRMED'));
        }
      })
      .catch(() => {
        // Fallo no crítico en sidebar
      })
      .finally(() => {
        if (active) setLoadingAgenda(false);
      });

    return () => {
      active = false;
    };
  }, [session?.access_token]);

  return (
    <div className={styles.twoColumns}>
      <div className={styles.stack}>
        <div>
          <h1 style={{ margin: '0 0 8px' }}>Tu camino empieza aquí.</h1>
          <p className={styles.muted} style={{ margin: 0 }}>Gestiona tus próximos pasos laborales sin presiones.</p>
        </div>
        {createdNotice && <Notice>Perfil privado creado.</Notice>}
        {error && <Notice error>{error}</Notice>}
        {profileError && <><Notice error>{profileError}</Notice><Button onClick={reloadProfile}>Volver a cargar mi perfil</Button></>}

        {/* Próxima Acción Recomendada (D3-5) */}
        <section className={styles.card} style={{ borderLeft: '4px solid var(--color-primary, #0284c7)' }}>
          <div className={styles.stack}>
            <span className={styles.eyebrow} style={{ color: 'var(--color-primary, #0284c7)' }}>
              Próxima acción recomendada
            </span>
            {hasConfirmedProfile ? (
              <>
                <h3 style={{ margin: 0 }}>Explorar vacantes compatibles</h3>
                <p className={styles.context} style={{ margin: 0 }}>
                  Tu perfil confirmado te permite evaluar en privado qué requisitos cumples, cuáles faltan y solicitar orientación con IA sin compartir tu identidad ni postularte.
                </p>
                <div>
                  <Link to="/explorar" style={{ textDecoration: 'none' }}>
                    <Button>Explorar oportunidades de empleo</Button>
                  </Link>
                </div>
              </>
            ) : hasDraftProfile ? (
              <>
                <h3 style={{ margin: 0 }}>Completar y confirmar tu perfil</h3>
                <p className={styles.context} style={{ margin: 0 }}>
                  Para comparar tu compatibilidad y requisitos logísticos con vacantes reales de empleo, termina de revisar y confirmar tu perfil.
                </p>
                <div>
                  <Link to={profile?.active_draft ? resumeProfilePath(profile.active_draft) : '/perfil/cuenta'} style={{ textDecoration: 'none' }}>
                    <Button>Continuar construyendo mi perfil</Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: 0 }}>Crear tu espacio privado</h3>
                <p className={styles.context} style={{ margin: 0 }}>
                  Inicia tu perfil para descubrir oportunidades laborales acordes a tu formación e intereses.
                </p>
                <div>
                  <Button onClick={handleCreateProfile} disabled={pending}>
                    {pending ? 'Creando...' : 'Crear mi espacio privado'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.stack}>
            <span className={styles.eyebrow}>Espacio del candidato</span>
            <h2 style={{ margin: 0 }}>
              {hasConfirmedProfile
                ? 'Perfil oficial confirmado'
                : hasDraftProfile
                ? 'Borrador de perfil en preparación'
                : me?.profile ? 'Tu espacio privado' : 'Construir tu perfil, a tu ritmo.'}
            </h2>
            {profileLoading && <p role="status">Cargando tu perfil guardado…</p>}
            {(profile?.active_draft || profile?.current_version) && <div>
              <p>{(profile.current_version || profile.active_draft)?.display_name || 'Nombre pendiente'} · {(profile.current_version || profile.active_draft)?.experiences.length} experiencias · {(profile.current_version || profile.active_draft)?.trainings.length} estudios y cursos</p>
              <Link to="/perfil" className={styles.navLink}>Ver mi perfil guardado</Link>
            </div>}
            {me?.profile && profile && !profile.active_draft && !profile.current_version_id && <Link to="/perfil/cuenta">Comenzar mi perfil</Link>}

            {!me?.profile && (
              <>
                <p className={styles.context}>
                  Tu perfil es totalmente privado. Podrás definir tus áreas de interés y trayectoria cuando lo desees.
                </p>
                <div>
                  <Button onClick={handleCreateProfile} disabled={pending}>
                    {pending ? 'Creando...' : 'Crear mi espacio privado'}
                  </Button>
                </div>
              </>
            )}

            {hasDraftProfile && (
              <div className={styles.stack}>
                <p className={styles.context}>
                  Tienes un borrador en curso. Continúa completando tu cuenta, experiencia y disponibilidad horaria.
                </p>
                <div>
                  <Link to={profile?.active_draft ? resumeProfilePath(profile.active_draft) : '/perfil/cuenta'} style={{ textDecoration: 'none' }}>
                    <Button>Continuar construyendo mi perfil</Button>
                  </Link>
                </div>
              </div>
            )}

            {hasConfirmedProfile && (
              <div className={styles.stack}>
                <p className={styles.context}>
                  Tu perfil está confirmado y guardado. Puedes consultar su contenido; seguirá siendo privado hasta que autorices compartirlo.
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Link to="/perfil" style={{ textDecoration: 'none' }}>
                    <Button>Revisar mi perfil confirmado</Button>
                  </Link>
                  {profile?.active_draft ? (
                    <Link to={resumeProfilePath(profile.active_draft)} style={{ textDecoration: 'none' }}>
                      <Button variant="secondary">Continuar editando mi borrador</Button>
                    </Link>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => handleStartEdit('/perfil/trayectoria')}
                      disabled={creatingDraft}
                    >
                      {creatingDraft ? 'Preparando editor…' : 'Editar o agregar más información'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={styles.feed}>
          <span className={styles.eyebrow}>Actividad reciente</span>
          <div className={styles.card}>
            {loadingComparisons ? (
              <p className={styles.muted} style={{ margin: 0 }}>Cargando comparaciones recientes…</p>
            ) : recentComparisons.length > 0 ? (
              <div className={styles.stack}>
                <p className={styles.context} style={{ margin: 0 }}>
                  Últimas evaluaciones de compatibilidad calculadas con rigor determinístico C01:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentComparisons.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              backgroundColor:
                                c.status === 'VIABLE' ? '#dcfce7' : c.status === 'PENDIENTE' ? '#fef3c7' : '#fee2e2',
                              color:
                                c.status === 'VIABLE' ? '#166534' : c.status === 'PENDIENTE' ? '#92400e' : '#991b1b',
                            }}
                          >
                            {c.status}
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                            {c.coverage_percent !== null ? `${c.coverage_percent}% cobertura` : 'Sin requisitos evaluables'}
                          </span>
                          {c.outdated && (
                            <span style={{ fontSize: '0.75rem', color: '#b45309' }}>
                              (Desactualizado)
                            </span>
                          )}
                        </div>
                        <p className={styles.muted} style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
                          {new Date(c.created_at).toLocaleDateString()} · {c.reasons[0] || 'Evaluación registrada'}
                        </p>
                      </div>
                      <Link to={`/explorar/${c.opportunity_id}`} className={styles.navLink}>
                        Ver detalle →
                      </Link>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Link to="/explorar" className={styles.navLink}>
                    Explorar más oportunidades
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <p className={styles.muted} style={{ margin: '0 0 12px' }}>
                  Sin actividad reciente registrada. Tus evaluaciones de compatibilidad y postulaciones aparecerán aquí.
                </p>
                <Link to="/explorar" className={styles.navLink}>Ir a Explorar vacantes</Link>
              </div>
            )}
          </div>
        </section>
      </div>
      <aside className={styles.sidebar}>
        <section className={styles.card}>
          <div className={styles.stack}>
            <span className={styles.eyebrow}>Agenda próxima</span>
            {loadingAgenda ? (
              <p className={styles.muted} style={{ margin: 0 }}>Cargando agenda…</p>
            ) : agendaEvents.length > 0 ? (
              <div className={styles.stack} style={{ gap: '8px' }}>
                <p className={styles.context} style={{ margin: 0, fontSize: '0.85rem' }}>
                  {agendaEvents.length} {agendaEvents.length === 1 ? 'evento confirmado' : 'eventos confirmados'}:
                </p>
                {agendaEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong>{ev.course_title}</strong>
                    <div className={styles.muted} style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][ev.weekday - 1]} · {ev.start_time} - {ev.end_time}
                    </div>
                  </div>
                ))}
                <Link to="/agenda" className={styles.navLink}>
                  Ver agenda completa ({agendaEvents.length}) →
                </Link>
              </div>
            ) : (
              <>
                <p className={styles.muted} style={{ margin: 0 }}>Sin eventos confirmados.</p>
                <Link to="/agenda" className={styles.navLink}>Ver agenda</Link>
              </>
            )}
            <hr className={styles.separator} />
            <Link to="/mi-cuenta" className={styles.navLink}>Configuración de cuenta</Link>
          </div>
        </section>
      </aside>
    </div>
  );
}
