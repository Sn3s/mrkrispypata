import { createClient, SupabaseClient } from '@supabase/supabase-js';

function readViteEnv(): { url: string; anon: string } | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (url && anon && /^https?:\/\//i.test(url)) return { url, anon };
  return null;
}

const initial = readViteEnv();
let resolvedUrl = initial?.url ?? '';
let resolvedAnon = initial?.anon ?? '';

let client: SupabaseClient | null = null;
let clientKey = '';

/** True when we still need to call `ensureSupabaseConfig()` (fetch /api/supabase-config on Vercel). */
export function needsSupabaseRuntimeBootstrap(): boolean {
  return !(resolvedUrl && resolvedAnon);
}

let ensureInFlight: Promise<void> | null = null;

/**
 * Fills Supabase URL + anon from Vite env (already done at module load) or from `/api/supabase-config` on Vercel.
 * Call once before relying on `isSupabaseConfigured()` when `needsSupabaseRuntimeBootstrap()` is true.
 */
export async function ensureSupabaseConfig(): Promise<void> {
  if (resolvedUrl && resolvedAnon) return;
  if (ensureInFlight) {
    await ensureInFlight;
    return;
  }

  ensureInFlight = (async () => {
    try {
      const r = await fetch('/api/supabase-config', { credentials: 'same-origin' });
      if (!r.ok) return;
      const j = (await r.json()) as { url?: string; anonKey?: string };
      const u = j.url?.trim() ?? '';
      const a = j.anonKey?.trim() ?? '';
      if (u && a && /^https?:\/\//i.test(u)) {
        resolvedUrl = u;
        resolvedAnon = a;
        client = null;
        clientKey = '';
      }
    } catch {
      /* offline or no /api route (e.g. vite preview) */
    }
  })();

  try {
    await ensureInFlight;
  } finally {
    ensureInFlight = null;
  }
}

function supabaseEnv() {
  return { url: resolvedUrl, anon: resolvedAnon };
}

export function isSupabaseConfigured(): boolean {
  const { url, anon } = supabaseEnv();
  return Boolean(url && anon && /^https?:\/\//i.test(url));
}

export function getSupabase(): SupabaseClient {
  const { url, anon } = supabaseEnv();
  if (!url || !anon || !/^https?:\/\//i.test(url)) {
    throw new Error(
      'Supabase is not configured. For local dev: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and restart. For Vercel: add those or SUPABASE_URL + SUPABASE_ANON_KEY, then redeploy.'
    );
  }
  const key = `${url}\0${anon}`;
  if (!client || clientKey !== key) {
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    clientKey = key;
  }
  return client;
}
