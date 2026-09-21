import { error } from '../../_lib.js';

export function onRequestPost() {
  return error('Google sign-in is required for the admin portal.', 403, 'google_login_required');
}
