import { clean, error, json, readJson, safeEmail } from '../_lib.js';

export async function onRequestPost(context) {
  if (!context.env.VAYUTA_DB) return error('Commerce database is not configured.', 503, 'database_unconfigured');
  const body = await readJson(context.request);
  const email = safeEmail(body?.email);
  if (!email || !clean(body?.name, 120)) return error('Please provide your name and valid email.', 422);
  await context.env.VAYUTA_DB.prepare(
    'INSERT INTO inquiries (type, name, email, project, brief) VALUES (?, ?, ?, ?, ?)',
  ).bind('competition', clean(body.name, 120), email, clean(body.country, 80), 'VAYUTA World Circuit interest list').run();
  return json({ ok: true, message: 'You are on the VAYUTA World Circuit list.' });
}
