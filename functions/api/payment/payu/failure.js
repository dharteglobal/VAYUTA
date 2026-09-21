import { getOrder, updateOrder } from '../../../_lib.js';

export async function onRequestPost(context) {
  const form = await context.request.formData();
  const orderId = String(form.get('txnid') || '');
  if (context.env.VAYUTA_DB && orderId && await getOrder(context.env.VAYUTA_DB, orderId)) await updateOrder(context.env.VAYUTA_DB, orderId, { status: 'payment_failed' });
  return Response.redirect(`${context.env.PUBLIC_APP_URL || '/'}/checkout/cancel/?order=${encodeURIComponent(orderId)}&provider=payu`, 303);
}
