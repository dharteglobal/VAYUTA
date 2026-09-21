const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export function error(message, status = 400, code = 'request_error') {
  return json({ ok: false, error: message, code }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function safeEmail(value) {
  const email = clean(value, 160).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function uid(prefix = 'vy') {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

export function origin(context) {
  return context.env.PUBLIC_APP_URL || new URL(context.request.url).origin;
}

export async function sha512Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-512', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

export async function createAdminSession(secret) {
  const payload = btoa(JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  return `${payload}.${await hmac(payload, secret)}`;
}

export function adminSecret(env) {
  return env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD || '';
}

export async function createOAuthState(secret) {
  const payload = btoa(JSON.stringify({ exp: Date.now() + 1000 * 60 * 10, nonce: crypto.randomUUID() }));
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function verifyOAuthState(value, secret) {
  if (!value || !secret) return false;
  const [payload, signature] = String(value).split('.');
  if (!payload || !signature || (await hmac(payload, secret)) !== signature) return false;
  try {
    return JSON.parse(atob(payload)).exp > Date.now();
  } catch {
    return false;
  }
}

export async function isAdmin(request, secret) {
  if (!secret) return false;
  const raw = request.headers.get('cookie') || '';
  const session = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith('vayuta_admin='))?.split('=')[1];
  if (!session) return false;
  const [payload, signature] = session.split('.');
  if (!payload || !signature || (await hmac(payload, secret)) !== signature) return false;
  try {
    return JSON.parse(atob(payload)).exp > Date.now();
  } catch {
    return false;
  }
}

export const ADMIN_COOKIE = 'vayuta_admin';

export function sessionCookie(value, secure = true) {
  return `${ADMIN_COOKIE}=${value}; Path=/; Max-Age=604800; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax`;
}

export function clearSessionCookie(secure = true) {
  return `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax`;
}

export async function getOrder(db, id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
}

export async function updateOrder(db, id, values) {
  const entries = Object.entries(values);
  const set = entries.map(([key]) => `${key} = ?`).join(', ');
  await db.prepare(`UPDATE orders SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(...entries.map(([, value]) => value), id).run();
}

export function productFromCart(cart) {
  if (!Array.isArray(cart) || cart.length < 1 || cart.length > 8) return null;
  const items = cart.map((item) => ({
    productId: clean(item.productId || 'vayuta-original', 80),
    variant: clean(item.variant || '27 in / 68 cm', 80),
    color: clean(item.color || 'saffron', 40),
    quantity: Math.max(1, Math.min(5, Number(item.quantity) || 1)),
    unitPrice: 3900,
  }));
  if (items.some((item) => item.productId !== 'vayuta-original')) return null;
  return { items, total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) };
}

export async function paypalAccessToken(env) {
  const id = env.PAYPAL_CLIENT_ID;
  const secret = env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return null;
  const base = env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error('PayPal authentication failed');
  const data = await response.json();
  return { token: data.access_token, base };
}
