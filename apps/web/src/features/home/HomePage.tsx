import React, { useState } from 'react';
import { Link } from 'react-router';
import { useSession } from '../../app/session';
import { fetchData } from '../../lib/api';
import { Button, Notice } from '../../components/Controls';
import styles from '../../styles/App.module.css';

export function HomePage() {
  const { session, me, reload } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateProfile = async () => {
    if (!session?.access_token) return;
    try {
      setPending(true);
      setError(null);
      await fetchData('/me/candidate-profile', session.access_token, 'PUT', {});
      reload();
    } catch {
      setError('No se pudo crear el espacio privado. Reintente.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.twoColumns}>
      <div className={styles.stack}>
        <div>
          <h1 style={{ margin: '0 0 8px' }}>Tu camino empieza aquí.</h1>
          <p className={styles.muted} style={{ margin: 0 }}>Gestiona tus próximos pasos laborales sin presiones.</p>
        </div>
        {error && <Notice error>{error}</Notice>}
        <section className={styles.card}>
          <div className={styles.stack}>
            <span className={styles.eyebrow}>Espacio del candidato</span>
            <h2 style={{ margin: 0 }}>Construir tu perfil, a tu ritmo.</h2>
            {!me?.profile ? (
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
            ) : (
              <p className={styles.context}>
                Perfil privado creado. Los pasos de experiencia y disponibilidad se integrarán próximamente.
              </p>
            )}
          </div>
        </section>
        <section className={styles.feed}>
          <span className={styles.eyebrow}>Actividad reciente</span>
          <div className={styles.card}>
            <p className={styles.muted} style={{ margin: '0 0 12px' }}>Aquí aparecerá lo que cambie.</p>
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
