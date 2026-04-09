/**
 * Create a Supabase Auth user and set profiles.is_admin = true.
 *
 * Needs the service_role key (Dashboard → Project Settings → API → service_role).
 * Never commit that key or pass it in shell history on shared machines.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/create-admin.mjs <email> <password>
 *
 * Or add to .env.local (same folder as this script's cwd):
 *   SUPABASE_SERVICE_ROLE_KEY=...
 * then: node scripts/create-admin.mjs <email> <password>
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnvLocal() {
  const p = path.join(root, '.env.local');
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
}

loadEnvLocal();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
const password = process.argv[3];

if (!url || !serviceKey || !email || !password) {
  console.error(`
Missing arguments or env.

1. Copy "service_role" JWT from Supabase → Project Settings → API (secret).

2. Run from project root:
   SUPABASE_SERVICE_ROLE_KEY="<paste>" node scripts/create-admin.mjs "${email || 'you@example.com'}" "<password>"

Or add SUPABASE_SERVICE_ROLE_KEY to .env.local (do not commit).
`);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  if (error.message?.includes('already been registered')) {
    console.error('User already exists. To make them admin, run in SQL Editor:\n');
    console.error(`select id from auth.users where email = '${email.replace(/'/g, "''")}';`);
    console.error(`update public.profiles set is_admin = true where id = '<that-uuid>';`);
  } else {
    console.error('createUser failed:', error.message);
  }
  process.exit(1);
}

const userId = data.user.id;

const { error: upErr } = await supabase.from('profiles').update({ is_admin: true }).eq('id', userId);

if (upErr) {
  console.error('User created but profile update failed:', upErr.message);
  console.error('Run: update public.profiles set is_admin = true where id =', `'${userId}';`);
  process.exit(1);
}

console.log('OK — admin user ready.');
console.log('  Email:', email);
console.log('  User id:', userId);
