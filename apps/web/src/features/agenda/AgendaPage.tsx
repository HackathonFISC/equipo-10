import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import type { AgendaView, AgendaEventView, CourseReservationView } from '@equipo10/contracts';
import styles from './agenda.module.css';

const WEEKDAYS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export function AgendaPage() {
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AgendaEventView[]>([]);
  const [reservations, setReservations] = useState<CourseReservationView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadAgenda = async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      setError(null);

      const [agendaRes, resList] = await Promise.all([
        fetchData<AgendaView>('/me/agenda', session.access_token),
        fetchData<{ items: CourseReservationView[] }>('/me/course-reservations', session.access_token),
      ]);

      setEvents(agendaRes.events || []);
      setReservations(resList.items || []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar tu agenda de clases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgenda();
  }, [session?.access_token]);

  // Agrupar eventos por día de la semana
  const groupedEvents: Record<number, AgendaEventView[]> = {};
  for (const ev of events) {
    if (!groupedEvents[ev.weekday]) {
      groupedEvents[ev.weekday] = [];
    }
    groupedEvents[ev.weekday].push(ev);
  }

  const activeDays = Object.keys(groupedEvents)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mi Agenda de Formación</h1>
        <p className={styles.subtitle}>
          Visualiza tus sesiones lectivas semanales sincronizadas en tiempo real con tus reservas confirmadas.
        </p>
      </div>

      {error && (
        <Notice error title="Error de carga">
          {error}
        </Notice>
      )}

      {loading ? (
        <p>Cargando sesiones formativas...</p>
      ) : events.length === 0 ? (
        <div className={styles.emptyCard}>
          <div style={{ fontSize: '48px' }}>📅</div>
          <h2 className={styles.emptyTitle}>No tienes clases programadas</h2>
          <p className={styles.emptyText}>
            Actualmente no cuentas con ninguna reserva activa en cursos formativos. Explora nuestro catálogo de cursos o diseña tu itinerario formativo en Mi Ruta para inscribirte.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/cursos">
              <Button>Explorar cursos disponibles →</Button>
            </Link>
            <Link to="/mi-ruta">
              <Button variant="secondary">Diseñar mi ruta formativa</Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {activeDays.map((dayNum) => (
              <div key={dayNum} className={styles.dayCard}>
                <div className={styles.dayHeader}>
                  <h2 className={styles.dayTitle}>{WEEKDAYS[dayNum]}</h2>
                  <span className={styles.dayCount}>
                    {groupedEvents[dayNum].length} {groupedEvents[dayNum].length === 1 ? 'sesión' : 'sesiones'}
                  </span>
                </div>
                <ul className={styles.eventList}>
                  {groupedEvents[dayNum].map((ev) => {
                    const resMatch = reservations.find((r) => r.id === ev.reservation_id);
                    return (
                      <li key={ev.id} className={styles.eventItem}>
                        <div className={styles.eventTime}>
                          ⏱️ {ev.start_time} - {ev.end_time} ({ev.timezone})
                        </div>
                        <h3 className={styles.eventTitle}>{ev.course_title}</h3>
                        <div className={styles.eventLocation}>
                          {ev.location ? `📍 ${ev.location}` : '💻 Formación virtual / remota'}
                        </div>
                        {resMatch && (
                          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                              Reserva: <strong>{resMatch.reservation_number}</strong>
                            </span>
                            <Link to={`/mi-ruta/reservar?edition_id=${resMatch.edition_id}`}>
                              <Button variant="text" style={{ fontSize: '13px', padding: '4px 8px' }}>
                                Gestionar plaza
                              </Button>
                            </Link>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <Link to="/cursos">
              <Button variant="secondary">Ver más cursos</Button>
            </Link>
            <Link to="/mi-ruta">
              <Button variant="secondary">Mi Ruta Formativa</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
