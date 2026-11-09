# Kandi app backend

Supabase does two things only: it holds a **copy of the products and
categories** for the app to read fast, and it does **Google sign-in**.
Everything else (account, addresses, orders, reward points, payments) stays in
WooCommerce.

```
WooCommerce ──products, categories──▶ woo-sync ──▶ Supabase ──▶ app (browse)
app ── Google sign-in ──▶ Supabase Auth
app ── account, addresses, orders, points ──▶ WordPress: kandi-mobile-api.php ──▶ WooCommerce
```

---

## Supabase

1. **Tables.** SQL Editor: run `migrations/20261109000000_kandi_app.sql`.
   The app uses only `products` and `categories` from it.
2. **Sync function.** Edge Functions: `woo-sync` from `functions/woo-sync/index.ts`,
   **Verify JWT off**, secret `KANDI_SYNC_SECRET`.
3. **Google sign-in.**
   - In Google Cloud Console > APIs & Services > Credentials, create an
     **OAuth client ID** of type **Web application**, with the authorised
     redirect URI `https://lorcztiuvskywjldjfxc.supabase.co/auth/v1/callback`.
     (FlutterFlow will also ask for Android/iOS client IDs; create those in the
     same place when it does.)
   - Supabase > Authentication > Sign In / Providers > **Google**: on, paste
     the Web client ID and secret, save.
4. **Turn off what is no longer used.**
   - Authentication > Sign In / Providers > **Phone**: off.
   - Authentication > Auth Hooks: delete the **Send SMS** hook.
   - Edge Functions: delete **send-sms** and **place-order**.
   - Secrets you can delete: `SEND_SMS_HOOK_SECRET`, `KANDI_SMS_USERNAME`,
     `KANDI_SMS_PASSWORD`, `KANDI_SMS_SENDER_ID`, `KANDI_WP_API_URL`,
     `KANDI_API_SECRET`, `KANDI_CHECKOUT_SECRET`, `KANDI_SITE_URL`.
     Keep `KANDI_SYNC_SECRET`.

## WordPress

1. **Kandi Store API** 1.1.0 or later (`kandi-store-api.php`).
2. **Kandi Supabase Sync** (`kandi-supabase-sync.php`), already set up under
   Products > App sync.
3. **Kandi Mobile API** (`kandi-mobile-api.php`): upload, activate, then
   **Settings > Kandi Mobile App**:
   - Supabase project URL: `https://lorcztiuvskywjldjfxc.supabase.co`
   - Supabase anon key: the public anon key
   - Checkout secret: only if the website's Vercel settings have a
     `KANDI_CHECKOUT_SECRET`; otherwise leave empty.

## Rewards

Kept on each shopper's WooCommerce account: 1 point per UGX 1,000 of items,
added when the order is marked **Completed**; 100 points = UGX 1,000 off, up
to half the items. Cancelled, refunded or failed orders give spent points back.
