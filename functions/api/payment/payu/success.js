import { error, getOrder, json, sha512Hex, updateOrder } from '../../../_lib.js';

export async function onRequestPost(context) {
  const form = await context.request.formData();
  const orderId = String(form.get('txnid') || '');
  const db = context.env.VAYUTA_DB;
  if (!db || !orderId) return Response.redirect(`${context.env.PUBLIC_APP_URL || '/'}/checkout/cancel/?reason=missing_order`, 303);
  const order = await getOrder(db, orderId);
  const status = String(form.get('status') || '');
  const reverse = [context.env.PAYU_SALT, status, '', '', '', '', '', '', '', '', '', String(form.get('email') || ''), String(form.get('firstname') || ''), String(form.get('productinfo') || ''), String(form.get('amount') || ''), orderId, context.env.PAYU_MERCHANT_KEY].join('|');
  const valid = context.env.PAYU_SALT && form.get('hash') === await sha512Hex(reverse);
  if (order && status === 'success' && valid) await updateOrder(db, orderId, { status: 'paid', provider_order_id: String(form.get('mihpayid') || orderId) });
  return Response.redirect(`${context.env.PUBLIC_APP_URL || '/'}/checkout/${status === 'success' && valid ? 'success' : 'cancel'}/?order=${encodeURIComponent(orderId)}&provider=payu`, 303);
}
