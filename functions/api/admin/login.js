import { createAdminSession, error, json, readJson, safeEmail, sessionCookie } from '../../_lib.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  if (!context.env.ADMIN_PASSWORD || !safeEmail(body?.email) || body.email.toLowerCase() !== String(context.env.ADMIN_EMAIL || '').toLowerCase() || body.password !== context.env.ADMIN_PASSWORD) {
    return error('Invalid admin credentials.', 401, 'invalid_credentials');
  }
  const session = await createAdminSession(context.env.ADMIN_PASSWORD);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(session, new URL(context.request.url).protocol === 'https:') });
}
