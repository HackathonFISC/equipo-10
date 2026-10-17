import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '../../app/session';
import { useNavigate } from 'react-router';
import { fetchWithHeaders, ApiClientError } from '../../lib/api';
import type {
  ProfileDraftView,
  CandidateProfileView,
  ProfileDraftIdentityValues,
  ExperienceItem,
  TrainingItem,
  InterestItem,
  AvailabilityWindowView,
  ProfileConstraintsValues,
  DeclarationStatus,
  ProfileSection,
  ReviewDecision,
} from '@equipo10/contracts';

export function useDraft() {
  const navigate = useNavigate();
  const { session, me, reload: reloadSession } = useSession();
  const [draft, setDraft] = useState<ProfileDraftView | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const etagRef = useRef<string | null>(null);
  const token = session?.access_token;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const syncDraftAndEtag = useCallback((data: ProfileDraftView, rawEtag?: string | null) => {
    const nextEtag = rawEtag || data.revision.toString();
    etagRef.current = nextEtag;
    if (isMountedRef.current) {
      setDraft(data);
      setEtag(nextEtag);
    }
  }, []);

  const loadDraft = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setConflict(false);

    try {
      // 1. Ensure CandidateProfile exists
      if (!me?.profile) {
        await fetchWithHeaders('/me/candidate-profile', token, {
          method: 'PUT',
          body: {},
        });
        reloadSession();
      }

      // 2. Try fetching active draft
      try {
        const res = await fetchWithHeaders<ProfileDraftView>('/me/candidate-profile/draft', token);
        syncDraftAndEtag(res.data, res.etag);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) {
          const profile = await fetchWithHeaders<CandidateProfileView>('/me/candidate-profile', token);
          if (profile.data.current_version_id) {
            navigate('/perfil', { replace: true });
            return;
          }
          // No active draft, initialize one
          const initKey = `init-draft-${session?.user?.id || 'candidate'}-${Date.now()}`;
          try {
            const createRes = await fetchWithHeaders<ProfileDraftView>(
              '/me/candidate-profile/drafts',
              token,
              {
                method: 'POST',
                headers: { 'Idempotency-Key': initKey },
                body: { base_version_id: null },
              }
            );
            syncDraftAndEtag(createRes.data, createRes.etag);
          } catch (createErr) {
            // Si el borrador ya fue creado concurrentemente (ej. React StrictMode o dos pestañas), recuperar el borrador activo
            if (createErr instanceof ApiClientError && (createErr.status === 409 || createErr.code === 'ACTIVE_DRAFT_EXISTS')) {
              const retryRes = await fetchWithHeaders<ProfileDraftView>('/me/candidate-profile/draft', token);
              syncDraftAndEtag(retryRes.data, retryRes.etag);
            } else {
              throw createErr;
            }
          }
        } else {
          throw err;
        }
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Error de comunicación al cargar el borrador.');
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [token, me?.profile?.id, reloadSession, session?.user?.id, syncDraftAndEtag, navigate]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const saveIdentity = useCallback(
    async (values: ProfileDraftIdentityValues): Promise<boolean> => {
      const currentEtag = etagRef.current;
      if (!token || !currentEtag) {
        setError('No hay sesión o versión de borrador activa.');
        return false;
      }

      setSaving(true);
      setError(null);
      setConflict(false);

      try {
        const res = await fetchWithHeaders<ProfileDraftView>(
          '/me/candidate-profile/draft',
          token,
          {
            method: 'PATCH',
            headers: {
              'If-Match': currentEtag,
            },
            body: {
              section: 'identity',
              values,
            },
          }
        );

        syncDraftAndEtag(res.data, res.etag);
        return true;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          if (err instanceof ApiClientError) {
            if (err.status === 412) {
              setConflict(true);
              setError('El perfil cambió en otra pestaña o sesión. Recarga para continuar.');
            } else {
              setError(err.message);
            }
          } else {
            setError('Error de comunicación al guardar cambios.');
          }
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    },
    [token, syncDraftAndEtag]
  );

  const saveExperience = useCallback(
    async (values: { status?: DeclarationStatus; items: ExperienceItem[] }): Promise<boolean> => {
      const currentEtag = etagRef.current;
      if (!token || !currentEtag) {
        setError('No hay sesión o versión de borrador activa.');
        return false;
      }

      setSaving(true);
      setError(null);
      setConflict(false);

      try {
        const res = await fetchWithHeaders<ProfileDraftView>(
          '/me/candidate-profile/draft',
          token,
          {
            method: 'PATCH',
            headers: {
              'If-Match': currentEtag,
            },
            body: {
              section: 'experience',
              values,
            },
          }
        );

        syncDraftAndEtag(res.data, res.etag);
        return true;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          if (err instanceof ApiClientError) {
            if (err.status === 412) {
              setConflict(true);
              setError('El perfil cambió en otra pestaña o sesión. Recarga para continuar.');
            } else {
              setError(err.message);
            }
          } else {
            setError('Error de comunicación al guardar experiencias.');
          }
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    },
    [token, syncDraftAndEtag]
  );

  const saveTraining = useCallback(
    async (values: { status?: DeclarationStatus; items: TrainingItem[] }): Promise<boolean> => {
      const currentEtag = etagRef.current;
      if (!token || !currentEtag) {
        setError('No hay sesión o versión de borrador activa.');
        return false;
      }

      setSaving(true);
      setError(null);
      setConflict(false);

      try {
        const res = await fetchWithHeaders<ProfileDraftView>(
          '/me/candidate-profile/draft',
          token,
          {
            method: 'PATCH',
            headers: {
              'If-Match': currentEtag,
            },
            body: {
              section: 'training',
              values,
            },
          }
        );

        syncDraftAndEtag(res.data, res.etag);
        return true;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          if (err instanceof ApiClientError) {
            if (err.status === 412) {
              setConflict(true);
              setError('El perfil cambió en otra pestaña o sesión. Recarga para continuar.');
            } else {
              setError(err.message);
            }
          } else {
            setError('Error de comunicación al guardar formación.');
          }
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    },
    [token, syncDraftAndEtag]
  );

  const saveInterests = useCallback(
    async (values: { status?: DeclarationStatus; items: InterestItem[] }): Promise<boolean> => {
      const currentEtag = etagRef.current;
      if (!token || !currentEtag) {
        setError('No hay sesión o versión de borrador activa.');
        return false;
      }

      setSaving(true);
      setError(null);
      setConflict(false);

      try {
        const res = await fetchWithHeaders<ProfileDraftView>(
          '/me/candidate-profile/draft',
          token,
          {
            method: 'PATCH',
            headers: {
              'If-Match': currentEtag,
            },
            body: {
              section: 'interests',
              values,
            },
          }
        );

        syncDraftAndEtag(res.data, res.etag);
        return true;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          if (err instanceof ApiClientError) {
            if (err.status === 412) {
              setConflict(true);
              setError('El perfil cambió en otra pestaña o sesión. Recarga para continuar.');
            } else {
              setError(err.message);
            }
          } else {
            setError('Error de comunicación al guardar intereses.');
          }
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    },
    [token, syncDraftAndEtag]
  );

  const reviewSection = useCallback(
    async (section: ProfileSection, decision: ReviewDecision): Promise<boolean> => {
      const currentEtag = etagRef.current;
      if (!token || !currentEtag) {
        setError('No hay sesión o versión de borrador activa.');
        return false;
      }

      setSaving(true);
      setError(null);
      setConflict(false);

      try {
        const idempotencyKey = `review-${section}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await fetchWithHeaders(
          '/me/candidate-profile/draft/section-reviews',
          token,
          {
            method: 'POST',
            headers: {
              'If-Match': currentEtag,
              'Idempotency-Key': idempotencyKey,
            },
            body: {
              section,
              decision,
            },
          }
        );
        return true;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          if (err instanceof ApiClientError) {
            if (err.status === 412) {
              setConflict(true);
              setError('El perfil cambió en otra pestaña o sesión. Recarga para continuar.');
            } else {
              setError(err.message);
            }
          } else {
            setError('Error de comunicación al registrar revisión.');
          }
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    },
    [token]
  );

  const saveAvailability = useCallback(
    async (values: { windows: AvailabilityWindowView[] }): Promise<boolean> => {
      const currentEtag = etagRef.current;
      if (!token || !currentEtag) {
        setError('No hay sesión o versión de borrador activa.');
        return false;
      }

      setSaving(true);
      setError(null);
      setConflict(false);

      try {
        const res = await fetchWithHeaders<ProfileDraftView>(
          '/me/candidate-profile/draft',
          token,
          {
            method: 'PATCH',
            headers: {
              'If-Match': currentEtag,
            },
            body: {
              section: 'availability',
              values,
            },
          }
        );

        syncDraftAndEtag(res.data, res.etag);
        return true;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          if (err instanceof ApiClientError) {
            if (err.status === 412) {
              setConflict(true);
              setError('El perfil cambió en otra pestaña o sesión. Recarga para continuar.');
            } else {
              setError(err.message);
            }
          } else {
            setError('Error de comunicación al guardar disponibilidad horaria.');
          }
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    },
    [token, syncDraftAndEtag]
  );

  const saveConstraints = useCallback(
    async (values: ProfileConstraintsValues): Promise<boolean> => {
      const currentEtag = etagRef.current;
      if (!token || !currentEtag) {
        setError('No hay sesión o versión de borrador activa.');
        return false;
      }

      setSaving(true);
      setError(null);
      setConflict(false);

      try {
        const res = await fetchWithHeaders<ProfileDraftView>(
          '/me/candidate-profile/draft',
          token,
          {
            method: 'PATCH',
            headers: {
              'If-Match': currentEtag,
            },
            body: {
              section: 'constraints',
              values,
            },
          }
        );

        syncDraftAndEtag(res.data, res.etag);
        return true;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          if (err instanceof ApiClientError) {
            if (err.status === 412) {
              setConflict(true);
              setError('El perfil cambió en otra pestaña o sesión. Recarga para continuar.');
            } else {
              setError(err.message);
            }
          } else {
            setError('Error de comunicación al guardar logística y restricciones.');
          }
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    },
    [token, syncDraftAndEtag]
  );

  return {
    draft,
    etag,
    loading,
    saving,
    conflict,
    error,
    saveIdentity,
    saveExperience,
    saveTraining,
    saveInterests,
    saveAvailability,
    saveConstraints,
    reviewSection,
    reload: loadDraft,
  };
}
