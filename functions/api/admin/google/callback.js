import { adminSecret, createAdminSession, error, safeEmail, sessionCookie, verifyOAuthState } from '../../../_lib.js';

function go(context, path) {
  return Response.redirect(`${context.env.PUBLIC_APP_URL || new URL(context.request.url).origin}${path}`, 302);
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (url.searchParams.get('error')) return go(context, '/admin/?error=access_denied');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const secret = adminSecret(context.env);
  if (!code || !(await verifyOAuthState(state, secret))) return go(context, '/admin/?error=invalid_state');
  const clientId = String(context.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(context.env.GOOGLE_CLIENT_SECRET || '').trim();
  const redirectUri = context.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/admin/google/callback`;
  if (!clientId || !clientSecret) return go(context, '/admin/?error=google_not_configured');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!tokenResponse.ok) return go(context, '/admin/?error=token_exchange_failed');
  const tokens = await tokenResponse.json();
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } });
  if (!profileResponse.ok) return go(context, '/admin/?error=profile_failed');
  const profile = await profileResponse.json();
  const email = safeEmail(profile.email);
  const allowed = safeEmail(context.env.ADMIN_EMAIL);
  if (!profile.email_verified || !email || email !== allowed) return go(context, '/admin/?error=unauthorized_email');

  const session = await createAdminSession(secret);
  return new Response(null, {
    status: 302,
    headers: { location: `${context.env.PUBLIC_APP_URL || url.origin}/admin/`, 'set-cookie': sessionCookie(session, url.protocol === 'https:') },
  });
}
