# VAYUTA production checkout setup

The storefront and Cloudflare Pages Functions already support three hosted payment flows:

- Stripe Checkout: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- PayU India hosted checkout: `PAYU_MERCHANT_KEY`, `PAYU_SALT`, and `PAYU_ENV` (`test` or `live`)
- PayPal Orders API: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_ENV` (`sandbox` or `live`)

Add provider credentials as production secrets on the Pages project, then redeploy. Never place secret keys in `dist`, HTML, or client-side JavaScript.

The private admin portal is at `/admin/` and uses Google OAuth only. Set `ADMIN_EMAIL` to the exact authorised Google address, then configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI=https://vayuta.com/api/admin/google/callback` as Pages values/secrets. The current authorised admin email is `tarunthadani@gmail.com`.

Stripe should send `checkout.session.completed` events to:

`https://vayuta.com/api/webhooks/stripe`

The D1 database stores orders, line items, custom requests, newsletter signups, and competition interest-list entries. Payment secrets are intentionally not committed because provider credentials were not available in the workspace.
