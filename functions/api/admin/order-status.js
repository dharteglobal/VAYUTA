import { adminSecret, clean, error, isAdmin, json, readJson, updateOrder } from '../../_lib.js';

export async function onRequestPatch(context) {
  if (!await isAdmin(context.request, adminSecret(context.env))) return error('Admin login required.', 401, 'unauthorized');
  const body = await readJson(context.request);
  const status = clean(body?.status, 40);
  if (!body?.orderId || !['pending_payment', 'paid', 'payment_review', 'payment_failed', 'packing', 'shipped', 'delivered', 'cancelled'].includes(status)) return error('Invalid order update.', 422);
  await updateOrder(context.env.VAYUTA_DB, clean(body.orderId, 100), { status });
  return json({ ok: true });
}
