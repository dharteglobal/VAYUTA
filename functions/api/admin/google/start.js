import { adminSecret, createOAuthState, error } from '../../../_lib.js';

export async function onRequestGet(context) {
  const clientId = String(context.env.GOOGLE_CLIENT_ID || '').trim();
  const secret = adminSecret(context.env);
  if (!clientId || !secret) return error('Google sign-in is not configured yet.', 503, 'google_not_configured');
  const redirectUri = context.env.GOOGLE_REDIRECT_URI || `${new URL(context.request.url).origin}/api/admin/google/callback`;
  const state = await createOAuthState(secret);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}
