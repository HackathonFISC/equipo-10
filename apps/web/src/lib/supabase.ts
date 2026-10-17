import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function validateKey(key: string): boolean {
  if (!key || key.startsWith('sb_secret_') || key.includes('service_role')) {
    return false;
  }
  if (key.startsWith('sb_publishable_')) {
    return true;
  }
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload?.role === 'anon';
    } catch {
      return false;
    }
  }
  return false;
}

function initSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !validateKey(key)) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    return null;
  }
}

export const supabase = initSupabase();
