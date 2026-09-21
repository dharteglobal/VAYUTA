import { error, getOrder, json, paypalAccessToken, readJson, updateOrder } from '../../../_lib.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const orderId = String(body?.orderId || '');
  const db = context.env.VAYUTA_DB;
  if (!db || !orderId) return error('Order not found.', 422);
  const order = await getOrder(db, orderId);
  if (!order || !order.provider_order_id) return error('Order not found.', 404);
  const access = await paypalAccessToken(context.env);
  if (!access) return error('PayPal is not configured.', 503, 'paypal_unconfigured');
  const response = await fetch(`${access.base}/v2/checkout/orders/${order.provider_order_id}/capture`, {
    method: 'POST', headers: { authorization: `Bearer ${access.token}`, 'content-type': 'application/json' },
  });
  const data = await response.json();
  if (!response.ok) return error(data?.message || 'PayPal capture failed.', 502);
  await updateOrder(db, orderId, { status: data.status === 'COMPLETED' ? 'paid' : 'payment_review' });
  return json({ ok: true, status: data.status });
}
