import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, Notice } from '../../components/Controls';
import { useProfileView, resumeProfilePath } from './useProfileView';
import styles from '../../styles/App.module.css';
import viewStyles from './ProfilePage.module.css';

const time = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const periods: Record<string, string> = { HOUR: 'por hora', DAY: 'por día', WEEK: 'por semana', MONTH: 'por mes', COURSE: 'por curso' };
const modes: Record<string, string> = { BUS: 'bus', METRO: 'metro', WALKING: 'a pie', BICYCLE: 'bicicleta', PRIVATE_VEHICLE: 'vehículo propio', OTHER: 'otro' };

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, loading, error, reload, createDraftFromConfirmed, creatingDraft } = useProfileView();
  const [showDraft, setShowDraft] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <p role="status">Cargando los datos guardados de tu perfil…</p>;
  if (error) return <><Notice error>{error}</Notice><Button onClick={reload}>Volver a cargar mi perfil</Button></>;

  const handleStartEdit = async (targetPath = '/perfil/trayectoria') => {
    setActionError(null);
    if (profile?.active_draft) {
      navigate(targetPath);
      return;
    }
    if (!profile?.current_version_id) {
      navigate('/perfil/cuenta');
      return;
    }
    try {
      await createDraftFromConfirmed(profile.current_version_id);
      navigate(targetPath);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo iniciar la edición del perfil.');
    }
  };

  const data = showDraft || !profile?.current_version ? profile?.active_draft : profile.current_version;
  const isDraft = data?.status === 'DRAFT';

  return (
    <div className={`${styles.stack} ${viewStyles.container}`}>
      <h1>Mi perfil guardado</h1>
      <p>Este es el contenido que guardaste. Tu perfil es privado; verlo no comparte información ni crea un borrador nuevo.</p>

      {actionError && <Notice error>{actionError}</Notice>}

      {profile?.current_version && profile.active_draft && (
        <div>
          <Button variant="secondary" aria-pressed={!showDraft} onClick={() => setShowDraft(false)}>Versión confirmada</Button>{' '}
          <Button variant="secondary" aria-pressed={showDraft} onClick={() => setShowDraft(true)}>Borrador en edición</Button>
        </div>
      )}

      {!data ? (
        <>
          <Notice>Todavía no hay datos de perfil guardados.</Notice>
          <Link to="/perfil/cuenta">Comenzar mi perfil</Link>
        </>
      ) : (
        <>
          <Notice>
            {isDraft
              ? 'Guardado como borrador. Puedes seguir editando; todavía falta la confirmación final.'
              : `Perfil confirmado · Versión ${data.version_number}.`}
          </Notice>

          {isDraft ? (
            <div>
              <Link to={resumeProfilePath(data)}>Continuar desde el paso pendiente</Link>{' · '}
              <Link to="/perfil/revision">Revisar y confirmar mi perfil</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button onClick={() => handleStartEdit('/perfil/trayectoria')} disabled={creatingDraft}>
                {creatingDraft ? 'Preparando editor…' : 'Editar perfil o agregar información'}
              </Button>
              {profile?.active_draft && (
                <Link to={resumeProfilePath(profile.active_draft)} style={{ textDecoration: 'none' }}>
                  <Button variant="secondary">Continuar editando borrador</Button>
                </Link>
              )}
            </div>
          )}

          <section className={styles.card}>
            <h2>{data.display_name || 'Nombre por completar'}</h2>
            {data.headline && <p>{data.headline}</p>}
            {isDraft ? (
              <Link to="/perfil/cuenta">Editar nombre y presentación</Link>
            ) : (
              <button
                type="button"
                className={viewStyles.inlineLink}
                onClick={() => handleStartEdit('/perfil/cuenta')}
                disabled={creatingDraft}
              >
                Editar nombre y presentación
              </button>
            )}
          </section>

          <section className={styles.card}>
            <h2>Experiencia y actividades</h2>
            {data.experiences.length ? (
              data.experiences.map((entry) => (
                <article key={entry.id}>
                  <h3>{entry.title}</h3>
                  {entry.organization_name && <p>{entry.organization_name}</p>}
                  <p>{entry.description}</p>
                  <p>{entry.start_month || 'Inicio pendiente'} · {entry.ongoing ? 'Hasta ahora' : entry.end_month || 'Fin pendiente'}</p>
                </article>
              ))
            ) : (
              <p>{data.experience_status === 'NONE' ? 'Declaraste que todavía no tienes experiencia.' : 'Sin experiencias añadidas.'}</p>
            )}
            {isDraft ? (
              <Link to="/perfil/trayectoria">Editar experiencia, cursos e intereses</Link>
            ) : (
              <button
                type="button"
                className={viewStyles.inlineLink}
                onClick={() => handleStartEdit('/perfil/trayectoria')}
                disabled={creatingDraft}
              >
                Editar o agregar experiencia, cursos e intereses
              </button>
            )}
          </section>

          <section className={styles.card}>
            <h2>Estudios y cursos</h2>
            {data.trainings.length ? (
              data.trainings.map((entry) => (
                <article key={entry.id}>
                  <h3>{entry.name}</h3>
                  {entry.provider_name && <p>{entry.provider_name}</p>}
                  <p>{entry.completed_on || 'Fecha de finalización pendiente'}</p>
                </article>
              ))
            ) : (
              <p>Sin estudios o cursos añadidos.</p>
            )}
          </section>

          <section className={styles.card}>
            <h2>Intereses laborales</h2>
            {data.interests.length ? (
              <ul>
                {data.interests.map((entry) => (
                  <li key={entry.id}>{entry.original_text}</li>
                ))}
              </ul>
            ) : (
              <p>Sin intereses añadidos.</p>
            )}
          </section>

          <section className={styles.card}>
            <h2>Disponibilidad y preferencias</h2>
            {data.windows.length ? (
              <ul>
                {data.windows.map((entry) => (
                  <li key={entry.id}>
                    {days[entry.weekday - 1]} · {time(entry.start_minute)}–{time(entry.end_minute)} · {entry.timezone}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Horario pendiente.</p>
            )}
            <p>Zona: {data.constraints?.approximate_zone || 'Pendiente'}</p>
            <p>Movilidad: {data.constraints?.mobility_modes.map((mode) => modes[mode] || mode).join(', ') || 'Pendiente'}</p>
            <p>Traslado máximo: {data.constraints?.max_one_way_minutes != null ? `${data.constraints.max_one_way_minutes} minutos por trayecto` : 'Pendiente'}</p>
            <p>Salario mínimo: {data.constraints?.minimum_salary != null ? `${data.constraints.minimum_salary} ${data.constraints.salary_currency || ''} ${periods[data.constraints.salary_period || ''] || ''}` : 'Pendiente'}</p>
            <p>Presupuesto de transporte: {data.constraints?.transport_budget != null ? `${data.constraints.transport_budget} ${data.constraints.transport_currency || ''} ${periods[data.constraints.transport_period || ''] || ''}` : 'Pendiente'}</p>
            <p>Presupuesto de formación: {data.constraints?.training_budget != null ? `${data.constraints.training_budget} ${data.constraints.training_currency || ''} ${periods[data.constraints.training_period || ''] || ''}` : 'Pendiente'}</p>
            {isDraft ? (
              <Link to="/perfil/disponibilidad">Editar disponibilidad y preferencias</Link>
            ) : (
              <button
                type="button"
                className={viewStyles.inlineLink}
                onClick={() => handleStartEdit('/perfil/disponibilidad')}
                disabled={creatingDraft}
              >
                Editar disponibilidad y preferencias
              </button>
            )}
          </section>
        </>
      )}
      <Link to="/inicio">Volver a Inicio</Link>
    </div>
  );
}
