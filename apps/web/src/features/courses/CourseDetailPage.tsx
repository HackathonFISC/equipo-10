import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import type { CourseDetailView } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { TrainingAssessmentPanel } from '../training-center/TrainingAssessmentPanel';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from './courses.module.css';

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const [course, setCourse] = useState<CourseDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourse = useCallback(async () => {
    if (!session?.access_token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchData<CourseDetailView>(`/courses/${id}`, session.access_token);
      setCourse(res);
    } catch {
      setError('No se pudo cargar el detalle del curso.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, id]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const formatModality = (mode: string) => {
    switch (mode) {
      case 'ON_SITE':
        return 'Presencial';
      case 'REMOTE':
        return 'Online / Remoto';
      case 'HYBRID':
        return 'Híbrido';
      default:
        return mode;
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric', timeZone:'UTC' });
    } catch {
      return iso;
    }
  };

  const formatTimeMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const formatWeekday = (day: number) => {
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days[day] || `Día ${day}`;
  };

  const formatPrice = (amount: string | null | undefined, currency: string | null | undefined) => {
    if (!amount) return 'Gratuito / Beca 100%';
    const num = parseFloat(amount);
    if (isNaN(num) || num === 0) return 'Gratuito / Beca 100%';
    return `$${amount} ${currency || 'USD'}`;
  };

  if (loading) {
    return (
      <div className={styles.detailContainer}>
        <div className={styles.emptyState}>
          <p>Cargando información del curso...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className={styles.detailContainer}>
        <Notice error title="Error">
          {error || 'Curso no encontrado'}
          <div style={{ marginTop: '12px' }}>
            <Link to="/cursos" className={styles.backLink}>← Volver a Cursos</Link>
          </div>
        </Notice>
      </div>
    );
  }

  return (
    <div className={styles.detailContainer}>
      <div>
        <Link to="/cursos" className={styles.backLink}>← Volver al catálogo de cursos</Link>
      </div>

      <div className={styles.detailHeader}>
        <div className={styles.badges}>
          {course.is_demo && <span className={`${styles.badge} ${styles.badgeDemo}`}>Demo</span>}
          <span className={`${styles.badge} ${styles.badgeMode}`}>v{course.version.version_number}</span>
          <span className={`${styles.badge} ${styles.badgeMode}`}>{course.code}</span>
        </div>
        <h1 className={styles.title}>{course.title}</h1>
        <p className={styles.subtitle}>
          Impartido por <strong>{course.organization.name}</strong>
        </p>
      </div>

      <div className={styles.detailCard}>
        <h2 className={styles.sectionTitle}>Descripción del programa</h2>
        <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text)' }}>
          {course.description}
        </p>
        {course.version.syllabus_text && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Plan de estudios / Sílabo:</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-secondary)', whiteSpace: 'pre-line' }}>
              {course.version.syllabus_text}
            </p>
          </div>
        )}
        {course.version.duration_hours && (
          <div className={styles.cardMeta}>
            <div className={styles.metaItem}>
              <span>⏱️ <strong>Carga horaria:</strong> {course.version.duration_hours} horas lectivas</span>
            </div>
          </div>
        )}
      </div>

      {/* Resultados de aprendizaje */}
      <div className={styles.detailCard}>
        <h2 className={styles.sectionTitle}>Resultados de aprendizaje esperados</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-secondary)' }}>
          Habilidades y conocimientos que desarrollarás al cursar este programa:
        </p>
        {course.learning_outcomes.length === 0 ? (
          <p style={{ color: 'var(--color-secondary)', fontSize: 14 }}>Sin competencias explícitas registradas.</p>
        ) : (
          <ul className={styles.outcomeList}>
            {course.learning_outcomes.map((outcome) => (
              <li key={outcome.id} className={styles.outcomeItem}>
                <div>
                  <strong>{outcome.competency_name || 'Competencia'}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-secondary)' }}>
                    {outcome.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Prerrequisitos */}
      <div className={styles.detailCard}>
        <h2 className={styles.sectionTitle}>Prerrequisitos formativos</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-secondary)' }}>
          Competencias previas requeridas para aprovechar adecuadamente el contenido:
        </p>
        {course.prerequisites.length === 0 ? (
          <p style={{ color: 'var(--color-secondary)', fontSize: 14 }}>
            Este curso no exige prerrequisitos formales previos; nivel inicial o abierto.
          </p>
        ) : (
          <ul className={styles.prereqList}>
            {course.prerequisites.map((prereq) => (
              <li key={prereq.id} className={styles.prereqItem}>
                <div>
                  <strong>{prereq.competency_name || 'Competencia'}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-secondary)' }}>
                    {prereq.description}
                  </p>
                </div>
                <span className={`${styles.badge} ${prereq.essential ? styles.badgeDemo : styles.badgeMode}`}>
                  {prereq.essential ? 'Obligatorio' : 'Recomendado'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ediciones convocadas y horarios */}
      <div className={styles.detailCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.sectionTitle}>Ediciones convocadas ({course.editions.length})</h2>
          <Link to="/mi-ruta" style={{ fontSize: 14, color: 'var(--color-action)', textDecoration: 'none', fontWeight: 600 }}>
            Planificar en Mi Ruta →
          </Link>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-secondary)' }}>
          Fechas, cupos en tiempo real y cronograma semanal de clases:
        </p>

        {course.editions.length === 0 ? (
          <p style={{ color: 'var(--color-secondary)', fontSize: 14 }}>
            Actualmente no hay convocatorias abiertas para este curso. Consulta más adelante.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {course.editions.map((edition) => (
              <div key={edition.id} className={styles.editionCard} data-testid={`edition-card-${edition.id}`}>
                <div className={styles.editionHeader}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
                      Modalidad: {formatModality(edition.modality)}
                    </h3>
                    <span style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                      Fechas: {formatDate(edition.start_date)} — {formatDate(edition.end_date)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`${styles.badge} ${edition.available_slots > 0 ? styles.badgeSlots : styles.badgeSlotsEmpty}`}>
                      {edition.available_slots > 0
                        ? `${edition.available_slots} de ${edition.total_slots} plazas libres`
                        : 'Agotado'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                      {formatPrice(edition.cost_amount, edition.cost_currency)}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
                  ⏱️ Horario general: <strong>{edition.schedule_summary}</strong>
                  {edition.location && ` • 📍 ${edition.location}`}
                </div>

                {/* Sesiones semanales */}
                {edition.sessions && edition.sessions.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>
                      Sesiones programadas ({edition.sessions.length}):
                    </strong>
                    <ul className={styles.sessionList}>
                      {edition.sessions.map((session, idx) => (
                        <li key={session.id || idx} className={styles.sessionItem}>
                          <span>
                            📅 <strong>{formatWeekday(session.weekday)}</strong>: {formatTimeMinutes(session.start_minute)} - {formatTimeMinutes(session.end_minute)} ({session.timezone})
                          </span>
                          <span>
                            {session.location ? `📍 ${session.location}` : '💻 Remoto'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <Link to={`/mi-ruta?edition_id=${edition.id}`}>
                    <Button variant="secondary">Incluir en mi ruta</Button>
                  </Link>
                  <Link to={`/mi-ruta/reservar?course_id=${course.id}&edition_id=${edition.id}`}>
                    <Button disabled={edition.available_slots === 0}>
                      {edition.available_slots > 0 ? 'Reservar plaza' : 'Sin cupo'}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <TrainingAssessmentPanel key={course.id} courseId={course.id} />
    </div>
  );
}
