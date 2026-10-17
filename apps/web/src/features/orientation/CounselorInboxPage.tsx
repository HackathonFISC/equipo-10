import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import type { CounselorInboxItemView } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from './counselor.module.css';

export function CounselorInboxPage() {
  const { session, me } = useSession();
  const [items, setItems] = useState<CounselorInboxItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchData<CounselorInboxItemView[]>('/counselor/inbox', session.access_token);
      setItems(res);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la bandeja de acompañamiento.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return <span className={`${styles.badge} ${styles.badgeRequested}`}>Solicitado</span>;
      case 'IN_REVIEW':
        return <span className={`${styles.badge} ${styles.badgeReview}`}>En revisión</span>;
      case 'CLARIFICATION_REQUESTED':
        return <span className={`${styles.badge} ${styles.badgeClarification}`}>Aclaración enviada</span>;
      case 'APPROVED':
        return <span className={`${styles.badge} ${styles.badgeApproved}`}>Aprobado</span>;
      case 'REJECTED':
        return <span className={`${styles.badge} ${styles.badgeRejected}`}>Rechazado</span>;
      case 'OUTDATED':
        return <span className={`${styles.badge} ${styles.badgeOutdated}`}>Ruta desactualizada</span>;
      case 'REVOKED':
        return <span className={`${styles.badge} ${styles.badgeRevoked}`}>Revocado</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '24px' }}>🧑‍🏫</span>
          <h1 className={styles.title}>Bandeja de Acompañamiento</h1>
        </div>
        <p className={styles.subtitle}>
          {me?.counselor?.display_name
            ? `Orientador: ${me.counselor.display_name}. Casos de jóvenes asignados con consentimiento explícito.`
            : 'Revisión y orientación de rutas formativas de jóvenes.'}
        </p>
      </div>

      {error && (
        <Notice error title="Error de carga">
          {error}
        </Notice>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Solicitudes de Acompañamiento ({items.length})</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-secondary)' }}>
              Acceso a datos mínimos de perfil y a la versión concreta del plan formativo calculada por C01.
            </p>
          </div>
          <Button variant="secondary" onClick={loadInbox} disabled={loading}>
            {loading ? 'Actualizando...' : 'Refrescar bandeja'}
          </Button>
        </div>

        {items.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-secondary)' }}>
            <p style={{ margin: 0, fontSize: '16px' }}>📭 No tienes solicitudes de acompañamiento asignadas en este momento.</p>
            <p style={{ margin: '8px 0 0', fontSize: '13px' }}>
              Cuando un joven solicite tu apoyo desde "Mi Ruta", verás su caso reflejado aquí.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Candidato</th>
                  <th>Meta Laboral</th>
                  <th>Versión Ruta</th>
                  <th>Estado</th>
                  <th>Aclaraciones</th>
                  <th>Fecha de Solicitud</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} data-testid={`inbox-row-${item.id}`}>
                    <td>
                      <strong>{item.candidate_name}</strong>
                    </td>
                    <td>{item.target_opportunity_title || 'Ruta sin vacante específica'}</td>
                    <td>v{item.plan_version}</td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>{item.clarifications_count > 0 ? `${item.clarifications_count} nota(s)` : 'Ninguna'}</td>
                    <td>{new Date(item.requested_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/orientador/casos/${item.id}`}>
                        <Button variant="secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>
                          Examinar caso →
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
