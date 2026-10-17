import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice, Field } from '../../components/Controls';
import type { CourseDetailView, CourseReservationView } from '@equipo10/contracts';
import styles from './learning-route.module.css';

export function ReservationConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useSession();

  const editionId = searchParams.get('edition_id');
  const courseId = searchParams.get('course_id');
  const planId = searchParams.get('plan_id');

  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState<CourseDetailView | null>(null);
  const [reservation, setReservation] = useState<CourseReservationView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token || !editionId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Comprobar si ya existe una reserva activa para esta edición
        const existingList = await fetchData<{ items: CourseReservationView[] }>(
          '/me/course-reservations',
          session.access_token
        );
        const match = existingList.items.find((r) => r.edition_id === editionId && r.status === 'CONFIRMED');
        if (match) {
          setReservation(match);
        }

        // Si tenemos courseId, cargar detalle
        if (courseId) {
          const c = await fetchData<CourseDetailView>(`/courses/${courseId}`, session.access_token);
          setCourse(c);
        }
      } catch (err: any) {
        setError(err?.message || 'Error al cargar información de la edición.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [session?.access_token, editionId, courseId]);

  const handleConfirmReservation = async () => {
    if (!session?.access_token || !editionId || submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      const idempotencyKey = crypto.randomUUID();
      const res = await fetchData<CourseReservationView>(
        '/me/course-reservations',
        session.access_token,
        'POST',
        {
          edition_id: editionId,
          plan_id: planId || undefined,
        },
        undefined,
        {
          'Idempotency-Key': idempotencyKey,
        }
      );

      setReservation(res);
      setSuccessMsg(`¡Reserva confirmada con éxito! Tu número de comprobante es ${res.reservation_number}.`);
    } catch (err: any) {
      if (err?.code === 'NO_AVAILABLE_SLOTS') {
        setError('Lo sentimos: ya no quedan plazas disponibles en esta edición formativa.');
      } else if (err?.code === 'SCHEDULE_COLLISION') {
        setError('Atención: el horario de esta edición colisiona con otra reserva confirmada en tu agenda.');
      } else if (err?.code === 'PREREQUISITES_NOT_MET') {
        setError('Requisito no cumplido: no cuentas con los prerrequisitos acreditados requeridos para inscribirte.');
      } else if (err?.code === 'ALREADY_RESERVED') {
        setError('Ya posees una reserva confirmada para esta edición.');
      } else if (err?.code === 'PLAN_REVIEW_NOT_APPROVED') {
        setError('Acompañamiento pendiente: Esta edición forma parte de una ruta con acompañamiento solicitado pero aún no aprobada por tu orientador.');
      } else {
        setError(err?.message || 'No se pudo completar la reserva de plaza.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!session?.access_token || !reservation || cancelling) return;
    if (!cancellationReason.trim() || cancellationReason.trim().length < 5) {
      setError('Debes ingresar un motivo de cancelación de al menos 5 caracteres.');
      return;
    }

    try {
      setCancelling(true);
      setError(null);

      const idempotencyKey = crypto.randomUUID();
      const updated = await fetchData<CourseReservationView>(
        `/me/course-reservations/${reservation.id}/cancellations`,
        session.access_token,
        'POST',
        {
          reason: cancellationReason.trim(),
        },
        undefined,
        {
          'Idempotency-Key': idempotencyKey,
        }
      );

      setReservation(updated);
      setSuccessMsg('La reserva ha sido cancelada satisfactoriamente y la plaza fue liberada.');
    } catch (err: any) {
      setError(err?.message || 'Error al cancelar la reserva.');
    } finally {
      setCancelling(false);
    }
  };

  if (!editionId) {
    return (
      <div className={styles.container}>
        <Notice error title="Edición no especificada">
          No se proporcionó una edición formativa válida para reservar.
        </Notice>
        <Link to="/cursos">
          <Button variant="secondary">Volver al catálogo de cursos</Button>
        </Link>
      </div>
    );
  }

  const selectedEdition = course?.editions.find((e) => e.id === editionId);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className={styles.buttonAction}
            onClick={() => navigate(-1)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← Volver
          </button>
        </div>
        <h1 className={styles.title}>Confirmación de reserva de plaza</h1>
        <p className={styles.subtitle}>
          Asegura formalmente tu cupo en la edición formativa. Operación atómica con recibo comprobable y cancelación reversible.
        </p>
      </div>

      {successMsg && (
        <Notice title="Confirmación exitosa">
          {successMsg}
        </Notice>
      )}

      {error && (
        <Notice error title="Atención">
          {error}
        </Notice>
      )}

      {loading ? (
        <p>Cargando información de la edición...</p>
      ) : reservation ? (
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: reservation.status === 'CONFIRMED' ? '#dcfce7' : '#fee2e2',
                  color: reservation.status === 'CONFIRMED' ? '#166534' : '#991b1b',
                  marginBottom: '8px',
                }}
              >
                {reservation.status === 'CONFIRMED' ? '✓ RESERVA CONFIRMADA' : '✗ RESERVA CANCELADA'}
              </span>
              <h2 style={{ margin: '0 0 6px', fontSize: '20px' }}>{reservation.course_title}</h2>
              <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '14px' }}>
                Número de reserva: <strong>{reservation.reservation_number}</strong>
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>Plazas restantes en edición</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-action)' }}>
                {reservation.remaining_slots}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div><strong>Horario:</strong> {reservation.schedule_summary}</div>
            <div><strong>Fecha de confirmación:</strong> {new Date(reservation.created_at).toLocaleString()}</div>
            {reservation.cancelled_at && (
              <div><strong>Fecha de cancelación:</strong> {new Date(reservation.cancelled_at).toLocaleString()}</div>
            )}
            {reservation.cancellation_reason && (
              <div><strong>Motivo de cancelación:</strong> {reservation.cancellation_reason}</div>
            )}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to="/agenda">
              <Button>Ir a mi Agenda de clases →</Button>
            </Link>
            <Link to="/mi-ruta">
              <Button variant="secondary">Ver Mi Ruta Formativa</Button>
            </Link>
          </div>

          {reservation.status === 'CONFIRMED' && (
            <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--color-divider)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#991b1b' }}>Cancelar esta reserva</h3>
              <p style={{ fontSize: '14px', color: 'var(--color-secondary)', margin: '0 0 12px' }}>
                Si liberas tu plaza, estará disponible de inmediato para otros candidatos. Podrás volver a reservar más adelante si aún hay cupos.
              </p>
              <div style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Field
                  id="cancellation-reason"
                  label="Motivo de cancelación"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Ej: Conflicto sobrevenido de horario laboral"
                  required
                />
                <Button
                  variant="secondary"
                  onClick={handleCancelReservation}
                  disabled={cancelling}
                  style={{ color: '#991b1b', borderColor: '#fca5a5' }}
                >
                  {cancelling ? 'Cancelando...' : 'Liberar mi plaza'}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.card}>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>
            {course ? course.title : 'Edición formativa seleccionada'}
          </h2>

          {selectedEdition && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', margin: '12px 0 20px' }}>
              <div><strong>Modalidad:</strong> {selectedEdition.modality}</div>
              <div><strong>Fechas:</strong> {new Date(selectedEdition.start_date).toLocaleDateString()} a {new Date(selectedEdition.end_date).toLocaleDateString()}</div>
              <div><strong>Horario:</strong> {selectedEdition.schedule_summary || 'Horario regular'}</div>
              <div><strong>Plazas disponibles actualmente:</strong> {selectedEdition.available_slots}</div>
            </div>
          )}

          <div className={styles.calloutWarning}>
            <strong>Transacción atómica:</strong> Al hacer clic en «Confirmar reserva», el sistema comprobará tu disponibilidad, verificarás prerrequisitos y descontará una plaza de forma exclusiva en una transacción protegida.
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Button onClick={handleConfirmReservation} disabled={submitting}>
              {submitting ? 'Reservando plaza...' : 'Confirmar reserva de plaza'}
            </Button>
            <Button variant="secondary" onClick={() => navigate(-1)} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
