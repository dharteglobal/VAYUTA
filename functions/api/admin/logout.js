import { json, clearSessionCookie } from '../../_lib.js';

export function onRequestPost(context) {
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(new URL(context.request.url).protocol === 'https:') });
}
