import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { CredentialsSchema, PasswordResetSchema, UpdatePasswordSchema } from '@equipo10/contracts';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../app/session';
import { ThemeSelect } from '../../app/theme';
import { Button, Field, Notice, ProgressSteps } from '../../components/Controls';
import styles from '../../styles/App.module.css';

export function AccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, me, recovery, reload, clearRecovery } = useSession();

  const isRecovery = location.pathname === '/recuperar';
  const isSignup = location.pathname === '/registro/cuenta';
  const isLogin = !isRecovery && !isSignup;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  if ((session || me) && !recovery && !isRecovery) {
    return <Navigate to="/inicio" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setNotice(null);
    if (!supabase) return;

    try {
      setPending(true);
      if (isRecovery && session && recovery) {
        const val = UpdatePasswordSchema.safeParse({ password });
        if (!val.success) {
          setErrors({ password: 'La contraseña debe tener entre 8 y 128 caracteres.' });
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: val.data.password });
        if (error) setNotice({ text: 'No se pudo actualizar la contraseña. Reintente.', error: true });
        else {
          setNotice({ text: 'Contraseña actualizada correctamente.' });
          clearRecovery();
          reload();
          navigate('/inicio');
        }
      } else if (isRecovery) {
        const val = PasswordResetSchema.safeParse({ email });
        if (!val.success) {
          setErrors({ email: 'Introduce un correo electrónico válido.' });
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(val.data.email, { redirectTo: `${window.location.origin}/recuperar` });
        if (error) {
          setNotice({ text: 'No se pudo procesar la solicitud. Reintente.', error: true });
        } else {
          setNotice({ text: 'Si la cuenta existe, recibirás instrucciones en tu correo.' });
        }
      } else if (isSignup) {
        const val = CredentialsSchema.safeParse({ email, password });
        if (!val.success) {
          const fieldErr = val.error.flatten().fieldErrors;
          setErrors({
            email: fieldErr.email ? 'Introduce un correo válido.' : undefined,
            password: fieldErr.password ? 'La contraseña debe tener al menos 8 caracteres.' : undefined,
          });
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: val.data.email,
          password: val.data.password,
          options: { emailRedirectTo: `${window.location.origin}/acceso` },
        });
        if (error) setNotice({ text: 'No se pudo crear la cuenta. Revisa tus datos o intenta más tarde.', error: true });
        else if (data.session) reload();
        else setNotice({ text: 'Revisa tu correo para confirmar tu cuenta.' });
      } else {
        const val = CredentialsSchema.safeParse({ email, password });
        if (!val.success) {
          const fieldErr = val.error.flatten().fieldErrors;
          setErrors({
            email: fieldErr.email ? 'Introduce un correo válido.' : undefined,
            password: fieldErr.password ? 'La contraseña debe tener al menos 8 caracteres.' : undefined,
          });
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: val.data.email,
          password: val.data.password,
        });
        if (error) setNotice({ text: 'Credenciales inválidas o no verificadas.', error: true });
        else reload();
      }
    } catch {
      setNotice({ text: 'Ocurrió un error inesperado. Intenta de nuevo.', error: true });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>empleo /</Link>
        <ThemeSelect />
      </header>
      <main id="contenido" className={styles.main}>
        {!supabase && (
          <Notice error title="Configuración pendiente">
            Ejecuta bun run setup:web antes de iniciar.
          </Notice>
        )}
        {isSignup && <ProgressSteps current={0} />}
        <div className={`${styles.twoColumns} ${styles.accessForm}`}>
          <section className={styles.card}>
            <div className={styles.stack}>
              <div>
                <h1 style={{ margin: '0 0 8px' }}>Tu experiencia cuenta.</h1>
                <p className={styles.muted} style={{ margin: 0 }}>Accede a tu espacio privado. Puedes empezar sin CV.</p>
              </div>
              {notice && <Notice error={notice.error}>{notice.text}</Notice>}
              <form onSubmit={handleSubmit} className={styles.stack} noValidate>
                {(!isRecovery || !session || !recovery) && (
                  <Field
                    id="access-email"
                    label="Correo electrónico"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errors.email}
                    required
                    autoComplete="email"
                  />
                )}
                {(!isRecovery || (session && recovery)) && (
                  <Field
                    id="access-password"
                    label="Contraseña"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={errors.password}
                    required
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                  />
                )}
                <Button type="submit" disabled={pending || !supabase}>
                  {pending
                    ? 'Procesando...'
                    : isRecovery
                    ? session && recovery ? 'Guardar contraseña' : 'Enviar enlace'
                    : isSignup ? 'Crear cuenta' : 'Entrar'}
                </Button>
              </form>
              <div className={styles.actions}>
                {isLogin && (
                  <>
                    <Link to="/registro/cuenta" className={styles.navLink}>Crear cuenta</Link>
                    <Link to="/recuperar" className={styles.navLink}>Recuperar contraseña</Link>
                  </>
                )}
                {isSignup && <Link to="/acceso" className={styles.navLink}>Iniciar sesión</Link>}
                {isRecovery && <Link to="/acceso" className={styles.navLink}>Iniciar sesión</Link>}
              </div>
            </div>
          </section>
          <aside className={styles.card}>
            <div className={styles.stack}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Tu perfil sigue siendo privado.</h2>
              <p className={styles.context}>
                Crear una cuenta no comparte tus datos con ninguna empresa. Controlas exactamente qué y cuándo mostrar.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
