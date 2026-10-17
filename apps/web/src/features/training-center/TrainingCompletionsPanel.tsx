import React, { useEffect, useState } from 'react';
import type { TrainingCompletionView } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { Button, Notice } from '../../components/Controls';
import { fetchWithHeaders } from '../../lib/api';
import styles from './training-center.module.css';
import { TrainingCertificateAttachment } from './TrainingCertificateAttachment';

export function TrainingCompletionsPanel() {
  const { session } = useSession();
  const [items, setItems] = useState<TrainingCompletionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!session?.access_token) return;
    const abort = new AbortController();
    setLoading(true); setError('');
    fetchWithHeaders<{ items: TrainingCompletionView[] }>('/me/training-completions', session.access_token, { signal: abort.signal })
      .then(response => setItems(response.data.items))
      .catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudieron consultar tus resultados.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [session?.access_token, tick]);
  if (!session) return null;
  return <section className={styles.panel} aria-busy={loading} aria-label="Mis resultados de formación">
    <div className={styles.header}><div><h2>Mis resultados de formación</h2><p className={styles.muted}>Resultados registrados por los centros donde reservaste.</p></div><Button variant="text" disabled={loading} onClick={() => setTick(t => t + 1)}>Actualizar resultados</Button></div>
    {error ? <Notice error>{error}</Notice> : loading ? <Notice>Cargando tus resultados…</Notice> : items.length === 0 ? <p className={styles.muted}>Todavía no hay resultados registrados por tus centros.</p> : items.map(item => <article key={item.id} className={styles.proposal}><h3>{item.course_title ?? 'Resultado de formación'}</h3><span className={styles.badge}>{item.decision === 'COMPLETED' ? 'Curso finalizado' : 'Curso no finalizado'}</span>{item.reservation_number && <p>Reserva {item.reservation_number}</p>}<p>Fecha del resultado: {item.completed_on}</p><p>{item.reason}</p><TrainingCertificateAttachment completion={item} token={session.access_token} /></article>)}
  </section>;
}
