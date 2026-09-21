import { clean, error, json, readJson, safeEmail } from '../_lib.js';

export async function onRequestPost(context) {
  if (!context.env.VAYUTA_DB) return error('Commerce database is not configured.', 503, 'database_unconfigured');
  const body = await readJson(context.request);
  const email = safeEmail(body?.email);
  if (!email || !clean(body?.name, 120)) return error('Please provide a name and valid email.', 422);
  const type = clean(body?.type || 'custom', 40);
  await context.env.VAYUTA_DB.prepare(
    'INSERT INTO inquiries (type, name, email, project, brief) VALUES (?, ?, ?, ?, ?)',
  ).bind(type, clean(body.name, 120), email, clean(body.project, 120), clean(body.brief, 2000)).run();
  return json({ ok: true, message: 'Your note is in the air. We will reply soon.' });
}
