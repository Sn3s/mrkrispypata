/**
 * Vercel Serverless Function — reads Supabase URL + anon key from project env at request time.
 * Lets production work when only server-side vars are set (no Vite build-time VITE_* needed).
 *
 * Set in Vercel → Settings → Environment Variables (Production + Preview):
 *   SUPABASE_URL + SUPABASE_ANON_KEY
 * or the same values as:
 *   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 */
module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!url || !anonKey || !/^https?:\/\//i.test(url)) {
    return res.status(200).json({ url: '', anonKey: '' });
  }

  return res.status(200).json({ url, anonKey });
};
