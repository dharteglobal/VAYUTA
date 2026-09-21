import { clean, error, json, readJson, safeEmail } from '../_lib.js';

export async function onRequestPost(context) {
  if (!context.env.VAYUTA_DB) return error('Commerce database is not configured.', 503, 'database_unconfigured');
  const body = await readJson(context.request);
  const email = safeEmail(body?.email);
  if (!email) return error('Please enter a valid email.', 422);
  await context.env.VAYUTA_DB.prepare(
    'INSERT INTO inquiries (type, email, brief) VALUES (?, ?, ?)',
  ).bind('newsletter', email, 'Newsletter signup').run();
  return json({ ok: true, message: 'You are on the list.' });
}
