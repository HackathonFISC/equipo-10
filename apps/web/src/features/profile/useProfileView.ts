import { useEffect, useState, useCallback } from 'react';
import type { CandidateProfileView, ProfileDraftView } from '@equipo10/contracts';
import { useSession } from '../../app/session';
import { fetchWithHeaders } from '../../lib/api';

export function resumeProfilePath(draft: ProfileDraftView) {
  if (!draft.display_name?.trim()) return '/perfil/cuenta';
  if ([draft.experience_status, draft.training_status, draft.interests_status].includes('UNKNOWN')) return '/perfil/trayectoria';
  if (!draft.windows.length || !draft.constraints) return '/perfil/disponibilidad';
  return '/perfil/revision';
}

export function useProfileView() {
  const { session, me } = useSession();
  const [profile, setProfile] = useState<CandidateProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [tick, setTick] = useState(0);
  const token = session?.access_token;
  const profileId = me?.profile?.id;

  useEffect(() => {
    if (!token || !profileId) { setProfile(null); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(null);
    fetchWithHeaders<CandidateProfileView>('/me/candidate-profile', token, { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setProfile(response.data); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No pudimos cargar tu perfil.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, profileId, tick]);

  const createDraftFromConfirmed = useCallback(async (baseVersionId: string): Promise<ProfileDraftView> => {
    if (!token) throw new Error("No hay sesión activa");
    setCreatingDraft(true);
    try {
      const idempotencyKey = `edit-draft-${profileId || 'user'}-${baseVersionId}-${Date.now()}`;
      const res = await fetchWithHeaders<ProfileDraftView>(
        '/me/candidate-profile/drafts',
        token,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          body: { base_version_id: baseVersionId },
        }
      );
      setTick((v) => v + 1);
      return res.data;
    } finally {
      setCreatingDraft(false);
    }
  }, [token, profileId]);

  return {
    profile,
    loading,
    error,
    creatingDraft,
    reload: () => setTick((value) => value + 1),
    createDraftFromConfirmed,
  };
}
