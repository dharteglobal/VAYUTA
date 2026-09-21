import { json } from '../_lib.js';

export function onRequestGet(context) {
  return json({ ok: true, service: 'vayuta-commerce', time: new Date().toISOString() });
}
