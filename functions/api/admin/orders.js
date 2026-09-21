import { adminSecret, error, isAdmin, json } from '../../_lib.js';

export async function onRequestGet(context) {
  if (!await isAdmin(context.request, adminSecret(context.env))) return error('Admin login required.', 401, 'unauthorized');
  const rows = await context.env.VAYUTA_DB.prepare(`SELECT o.*, i.variant, i.color, i.quantity
    FROM orders o LEFT JOIN order_items i ON i.order_id = o.id ORDER BY o.created_at DESC LIMIT 100`).all();
  return json({ ok: true, orders: rows.results || [] });
}
