import { createClient, SupabaseClient } from '@supabase/supabase-js';

function supabaseEnv() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  return { url, anon };
}

let client: SupabaseClient | null = null;
let clientKey = '';

export function isSupabaseConfigured(): boolean {
  const { url, anon } = supabaseEnv();
  return Boolean(url && anon && /^https?:\/\//i.test(url));
}

export function getSupabase(): SupabaseClient {
  const { url, anon } = supabaseEnv();
  if (!url || !anon || !/^https?:\/\//i.test(url)) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and restart the dev server.');
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
