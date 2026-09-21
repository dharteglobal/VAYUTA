import { error, hmacSha256Hex, json, updateOrder } from '../../_lib.js';

function parseSignature(header) {
  return Object.fromEntries(String(header || '').split(',').map((part) => part.split('=')));
}

export async function onRequestPost(context) {
  const secret = context.env.STRIPE_WEBHOOK_SECRET;
  const raw = await context.request.text();
  if (!secret) return error('Stripe webhook is not configured.', 503);
  const parts = parseSignature(context.request.headers.get('stripe-signature'));
  const expected = await hmacSha256Hex(`${parts.t || ''}.${raw}`, secret);
  if (!parts.t || !parts.v1 || expected !== String(parts.v1)) return error('Invalid webhook signature.', 400);
  const event = JSON.parse(raw);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId && context.env.VAYUTA_DB) await updateOrder(context.env.VAYUTA_DB, orderId, { status: 'paid', provider_order_id: session.id });
  }
  return json({ received: true });
}
