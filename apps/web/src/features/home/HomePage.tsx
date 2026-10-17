import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from '../../styles/App.module.css';
import { useProfileView, resumeProfilePath } from '../profile/useProfileView';

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

  const hasConfirmedProfile = Boolean(profile?.current_version_id);
  const hasDraftProfile = Boolean(profile?.active_draft && !profile.current_version_id);

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
            <p className={styles.muted} style={{ margin: '0 0 12px' }}>
              Sin actividad reciente registrada. Tus postulaciones y eventos aparecerán aquí.
            </p>
            <Link to="/explorar" className={styles.navLink}>Ir a Explorar</Link>
          </div>
        </section>
      </div>
      <aside className={styles.sidebar}>
        <section className={styles.card}>
          <div className={styles.stack}>
            <span className={styles.eyebrow}>Agenda próxima</span>
            <p className={styles.muted} style={{ margin: 0 }}>Sin eventos confirmados.</p>
            <Link to="/agenda" className={styles.navLink}>Ver agenda</Link>
            <hr className={styles.separator} />
            <Link to="/mi-cuenta" className={styles.navLink}>Configuración de cuenta</Link>
          </div>
        </section>
      </aside>
    </div>
  );
}
