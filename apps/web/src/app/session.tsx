import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchData, MeViewSchema, type MeView, ApiClientError } from '../lib/api';

interface SessionContextValue {
  session: Session | null;
  me: MeView | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  signOut: () => Promise<void>;
  recovery: boolean;
  clearRecovery: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeView | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(supabase));
  const [error, setError] = useState<string | null>(supabase ? null : 'Configuración de autenticación no disponible.');
  const [recovery, setRecovery] = useState<boolean>(false);
  const [reloadTick, setReloadTick] = useState<number>(0);
  const generationRef = useRef<number>(0);

  const reload = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  const clearRecovery = useCallback(() => {
    setRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setMe(null);
    generationRef.current += 1;
    try {
      const { error: err } = await supabase.auth.signOut({ scope: 'local' });
      if (err) {
        setError('Error al cerrar sesión. Reintente.');
      } else {
        setSession(null);
        setRecovery(false);
        setError(null);
      }
    } catch {
      setError('Error al cerrar sesión. Reintente.');
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: initSession }, error: initErr }) => {
      if (!mounted) return;
      if (initErr) {
        setError('Error al verificar sesión.');
      } else {
        setSession(initSession);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setRecovery(false);
        setMe(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const currentGen = ++generationRef.current;
    const token = session?.access_token;

    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }

    setMe(null);
    setLoading(true);
    setError(null);
    const controller = new AbortController();

    fetchData<unknown>('/me', token, 'PUT', {}, controller.signal)
      .then((data) => {
        if (generationRef.current !== currentGen) return;
        const parsed = MeViewSchema.safeParse(data);
        if (parsed.success) {
          setMe(parsed.data);
          setError(null);
        } else {
          setError('Respuesta de usuario inválida.');
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (generationRef.current !== currentGen || controller.signal.aborted) return;
        if (err instanceof ApiClientError) {
          if (err.status === 401) {
            setMe(null);
            supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
            setError(err.message);
          } else if (err.status === 503) {
            setError(err.message);
          } else {
            setError(err.message);
          }
        } else {
          setError('Error al cargar perfil de usuario.');
        }
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [session?.access_token, reloadTick]);

  return (
    <SessionContext.Provider value={{ session, me, loading, error, reload, signOut, recovery, clearRecovery }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}
