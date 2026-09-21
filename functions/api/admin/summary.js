import { adminSecret, error, isAdmin, json } from '../../_lib.js';

export async function onRequestGet(context) {
  if (!await isAdmin(context.request, adminSecret(context.env))) return error('Admin login required.', 401, 'unauthorized');
  const db = context.env.VAYUTA_DB;
  if (!db) return error('Commerce database is not configured.', 503);
  const [orders, revenue, pending, inquiries] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM orders').first(),
    db.prepare("SELECT COALESCE(SUM(total_inr), 0) AS total FROM orders WHERE status = 'paid'").first(),
    db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('pending_payment', 'payment_review')").first(),
    db.prepare('SELECT COUNT(*) AS count FROM inquiries').first(),
  ]);
  return json({ ok: true, stats: { orders: orders.count, revenue: revenue.total, pending: pending.count, inquiries: inquiries.count } });
}
