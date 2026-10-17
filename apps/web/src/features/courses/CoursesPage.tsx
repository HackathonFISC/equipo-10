import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import type { CourseListItem, CourseListResponse } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { TrainingCompletionsPanel } from '../training-center/TrainingCompletionsPanel';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from './courses.module.css';

export function CoursesPage() {
  const { session } = useSession();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterText, setFilterText] = useState('');
  const [modality, setModality] = useState<string>('ALL');

  const loadCourses = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterText.trim()) {
        params.append('q', filterText.trim());
      }
      if (modality !== 'ALL') {
        params.append('modality', modality);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetchData<CourseListResponse>(
        `/courses${queryString}`,
        session.access_token
      );
      setCourses(res.items);
    } catch {
      setError('No se pudieron cargar los cursos. Reintente en un momento.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, filterText, modality]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleClearFilters = () => {
    setFilterText('');
    setModality('ALL');
  };

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

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return 'Por confirmar';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return iso;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist" aria-label="Secciones de exploración">
          <Link to="/explorar" className={styles.tab} role="tab" aria-selected="false">
            💼 Vacantes laborales
          </Link>
          <button type="button" className={`${styles.tab} ${styles.tabActive}`} role="tab" aria-selected="true">
            🎓 Cursos formativos
          </button>
        </div>
        <h1 className={styles.title}>Explorar cursos formativos</h1>
        <p className={styles.subtitle}>
          Explora cursos de los centros de formación y revisa qué habilidades puedes aprender para avanzar hacia tu meta laboral.
        </p>
      </div>

      <div className={styles.filterBar}>
        <input
          type="search"
          aria-label="Buscar curso por título o contenido"
          placeholder="Buscar por curso, tecnología o palabra clave..."
          className={styles.filterInput}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />

        <select
          aria-label="Filtrar por modalidad de impartición"
          className={styles.filterSelect}
          value={modality}
          onChange={(e) => setModality(e.target.value)}
        >
          <option value="ALL">Todas las modalidades</option>
          <option value="ON_SITE">Presencial</option>
          <option value="REMOTE">Online / Remoto</option>
          <option value="HYBRID">Híbrido</option>
        </select>

        {(filterText || modality !== 'ALL') && (
          <Button variant="text" onClick={handleClearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {error && (
        <Notice error title="Error al cargar cursos">
          {error}
          <div style={{ marginTop: '8px' }}>
            <Button onClick={loadCourses}>Reintentar</Button>
          </div>
        </Notice>
      )}

      {loading && !error && (
        <div className={styles.emptyState} role="status">
          <p>Cargando cursos disponibles...</p>
        </div>
      )}

      {!loading && !error && courses.length === 0 && (
        <div className={styles.emptyState}>
          <h3>No se encontraron cursos formativos</h3>
          <p>Prueba ajustando los términos de búsqueda o cambiando el filtro de modalidad.</p>
          {(filterText || modality !== 'ALL') && (
            <div style={{ marginTop: '12px' }}>
              <Button variant="secondary" onClick={handleClearFilters}>
                Restablecer filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className={styles.listGrid}>
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/cursos/${course.id}`}
              className={styles.card}
              data-testid={`course-card-${course.id}`}
            >
              <div className={styles.cardHeader}>
                <div className={styles.badges}>
                  {course.is_demo && (
                    <span className={`${styles.badge} ${styles.badgeDemo}`}>Demo</span>
                  )}
                  <span className={`${styles.badge} ${styles.badgeMode}`}>
                    {course.code}
                  </span>
                </div>
                {course.active_editions_count > 0 ? (
                  <span className={`${styles.badge} ${styles.badgeSlots}`}>
                    {course.active_editions_count} edición{course.active_editions_count > 1 ? 'es' : ''} activa{course.active_editions_count > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeSlotsEmpty}`}>
                    Sin ediciones activas
                  </span>
                )}
              </div>

              <div>
                <h2 className={styles.cardTitle}>{course.title}</h2>
                <span className={styles.orgName}>{course.organization.name}</span>
              </div>

              <p className={styles.cardSummary}>{course.description}</p>

              <div className={styles.cardMeta}>
                <div className={styles.metaItem}>
                  <span>📅 Próximo inicio: <strong>{formatDate(course.next_start_date)}</strong></span>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span>{course.active_editions_count} convocatorias abiertas</span>
                <span style={{ color: 'var(--color-action)', fontWeight: 600 }}>Ver detalle y ediciones →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <TrainingCompletionsPanel />
    </div>
  );
}
