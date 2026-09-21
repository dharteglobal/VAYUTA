import {
  clean, error, json, origin, paypalAccessToken, productFromCart, readJson, safeEmail, sha512Hex, uid, updateOrder,
} from '../_lib.js';

async function createStripeSession(env, order, cart) {
  if (!env.STRIPE_SECRET_KEY) return null;
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${origin({ env })}/checkout/success/?order=${order.id}&provider=stripe&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${origin({ env })}/checkout/cancel/?order=${order.id}`);
  form.set('customer_email', order.email);
  form.set('metadata[order_id]', order.id);
  form.set('line_items[0][price_data][currency]', 'inr');
  form.set('line_items[0][price_data][product_data][name]', 'VAYUTA Original');
  form.set('line_items[0][price_data][product_data][description]', `${cart.items[0].variant} · ${cart.items[0].color} print`);
  form.set('line_items[0][price_data][unit_amount]', String(cart.items[0].unitPrice * 100));
  form.set('line_items[0][quantity]', String(cart.items[0].quantity));
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${env.STRIPE_SECRET_KEY}:`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe checkout could not be created');
  return { url: data.url, providerOrderId: data.id };
}

async function createPaypalOrder(env, order, cart) {
  const access = await paypalAccessToken(env);
  if (!access) return null;
  const response = await fetch(`${access.base}/v2/checkout/orders`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: order.id, custom_id: order.id, amount: { currency_code: 'INR', value: cart.total.toFixed(2) }, description: 'VAYUTA Original' }],
      application_context: {
        brand_name: 'VAYUTA',
        user_action: 'PAY_NOW',
        return_url: `${origin({ env })}/checkout/success/?order=${order.id}&provider=paypal`,
        cancel_url: `${origin({ env })}/checkout/cancel/?order=${order.id}`,
      },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'PayPal checkout could not be created');
  return { url: data.links?.find((link) => link.rel === 'approve')?.href, providerOrderId: data.id };
}

async function createPayuOrder(env, order, cart) {
  if (!env.PAYU_MERCHANT_KEY || !env.PAYU_SALT) return null;
  const txnid = order.id;
  const amount = cart.total.toFixed(2);
  const productinfo = 'VAYUTA Original';
  const firstname = order.customer_name.split(' ')[0] || 'VAYUTA';
  const udf = ['', '', '', '', ''];
  const hashString = [env.PAYU_MERCHANT_KEY, txnid, amount, productinfo, firstname, order.email, ...udf, '', '', '', '', '', env.PAYU_SALT].join('|');
  const hash = await sha512Hex(hashString);
  const fields = {
    key: env.PAYU_MERCHANT_KEY, txnid, amount, productinfo, firstname, email: order.email,
    phone: order.phone, surl: `${origin({ env })}/api/payment/payu/success`, furl: `${origin({ env })}/api/payment/payu/failure`,
    service_provider: 'payu_paisa', hash, udf1: '', udf2: '', udf3: '', udf4: '', udf5: '', lastname: '', address1: order.address_line1,
    city: order.city, state: order.state, zipcode: order.postal_code, country: order.country,
  };
  const action = env.PAYU_ENV === 'live' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
  return { payu: true, action, fields, providerOrderId: txnid };
}

export async function onRequestPost(context) {
  const db = context.env.VAYUTA_DB;
  if (!db) return error('Commerce database is not configured.', 503, 'database_unconfigured');
  const body = await readJson(context.request);
  const cart = productFromCart(body?.items);
  const provider = clean(body?.provider || 'stripe', 20).toLowerCase();
  const email = safeEmail(body?.customer?.email);
  const name = clean(body?.customer?.name, 120);
  const phone = clean(body?.customer?.phone, 40);
  if (!cart || !['stripe', 'paypal', 'payu'].includes(provider)) return error('Choose a valid product and payment provider.', 422);
  if (!email || !name || !phone || !clean(body?.customer?.address, 300) || !clean(body?.customer?.city, 100) || !clean(body?.customer?.state, 100) || !clean(body?.customer?.postal, 20)) {
    return error('Please complete your contact and delivery details.', 422);
  }
  const order = {
    id: uid('vyorder'), customer_name: name, email, phone, address_line1: clean(body.customer.address, 300),
    city: clean(body.customer.city, 100), state: clean(body.customer.state, 100), postal_code: clean(body.customer.postal, 20),
    country: clean(body.customer.country || 'IN', 2).toUpperCase(), total_inr: cart.total, provider,
  };
  await db.prepare(`INSERT INTO orders (id, customer_name, email, phone, address_line1, city, state, postal_code, country, total_inr, provider)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(order.id, order.customer_name, order.email, order.phone, order.address_line1, order.city, order.state, order.postal_code, order.country, order.total_inr, order.provider).run();
  await db.prepare('INSERT INTO order_items (order_id, product_id, variant, color, quantity, unit_price_inr) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(order.id, cart.items[0].productId, cart.items[0].variant, cart.items[0].color, cart.items[0].quantity, cart.items[0].unitPrice).run();
  try {
    const payment = provider === 'stripe' ? await createStripeSession(context.env, order, cart)
      : provider === 'paypal' ? await createPaypalOrder(context.env, order, cart)
        : await createPayuOrder(context.env, order, cart);
    if (!payment) return error(`${provider} is not configured yet. Add its production credentials in Cloudflare Pages secrets.`, 503, `${provider}_unconfigured`);
    await updateOrder(db, order.id, { provider_order_id: payment.providerOrderId });
    return json({ ok: true, orderId: order.id, ...payment });
  } catch (err) {
    await updateOrder(db, order.id, { status: 'payment_error' });
    return error(err.message || 'Payment checkout could not be started.', 502, 'payment_provider_error');
  }
}
