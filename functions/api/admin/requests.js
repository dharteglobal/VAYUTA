import { adminSecret, error, isAdmin, json } from '../../_lib.js';

export async function onRequestGet(context) {
  if (!await isAdmin(context.request, adminSecret(context.env))) return error('Admin login required.', 401, 'unauthorized');
  if (!context.env.VAYUTA_DB) return error('Commerce database is not configured.', 503, 'database_unconfigured');
  const rows = await context.env.VAYUTA_DB.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 100').all();
  return json({ ok: true, requests: rows.results || [] });
}
