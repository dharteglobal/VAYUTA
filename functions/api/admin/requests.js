import { error, isAdmin, json } from '../../_lib.js';

export async function onRequestGet(context) {
  if (!await isAdmin(context.request, context.env.ADMIN_PASSWORD)) return error('Admin login required.', 401, 'unauthorized');
  const rows = await context.env.VAYUTA_DB.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 100').all();
  return json({ ok: true, requests: rows.results || [] });
}
