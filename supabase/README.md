# Kandi app backend: Supabase + WooCommerce

WooCommerce stays the shop. Supabase is the app's fast copy of the catalogue,
its sign-in, its order history and its reward points.

```
WooCommerce ──products, categories──▶ woo-sync ──▶ Supabase ──▶ app
WooCommerce ◀──────── orders ──────── place-order ◀──────────── app
WooCommerce ──order status──▶ woo-sync ──▶ Supabase (points awarded)
```

Do these steps in order. Each one takes a few minutes.

---

## 1. Create the project

[supabase.com](https://supabase.com) > New project (the free plan is enough
to start). Note the **Project URL** and the **anon** and **service_role**
keys under Project Settings > API.

## 2. Create the tables

**SQL Editor > New query**, paste all of
`migrations/20261109000000_kandi_app.sql`, press **Run**.

It creates `products`, `categories`, `profiles`, `addresses`, `orders`,
`points_ledger` and `reward_settings`, with security rules so a shopper can
only ever see their own orders, addresses and points.

## 3. Deploy the three functions

**Edge Functions > Deploy a new function > Via editor** (or the Supabase CLI).
Use these exact names and paste the matching `index.ts`:

| Name | File | Verify JWT |
|---|---|---|
| `woo-sync` | `functions/woo-sync/index.ts` | **Off** (WordPress calls it with a secret) |
| `place-order` | `functions/place-order/index.ts` | On |
| `send-sms` | `functions/send-sms/index.ts` | **Off** (Supabase Auth signs it) |

With the CLI: `supabase functions deploy woo-sync --no-verify-jwt`,
`supabase functions deploy place-order`,
`supabase functions deploy send-sms --no-verify-jwt`.

## 4. Add the secrets

**Edge Functions > Secrets** (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
are already there):

| Secret | Value |
|---|---|
| `KANDI_SYNC_SECRET` | A long random string you make up. The same goes into WordPress (step 6). |
| `KANDI_WP_API_URL` | `https://<your-wordpress>/wp-json/kandi/v1` (the website's `WP_API_URL`) |
| `KANDI_API_SECRET` | The website's `KANDI_API_SECRET` |
| `KANDI_CHECKOUT_SECRET` | The website's `KANDI_CHECKOUT_SECRET`; if the website does not set one, its `KANDI_API_SECRET` |
| `KANDI_SITE_URL` | `https://kandiug.com` |
| `KANDI_SMS_USERNAME` | Your EgoSMS username (the website's `KANDI_SMS_USERNAME`) |
| `KANDI_SMS_PASSWORD` | Your EgoSMS password |
| `KANDI_SMS_SENDER_ID` | `KandiUg` (optional) |
| `SEND_SMS_HOOK_SECRET` | From step 5 |

## 5. Turn on phone sign-in

1. **Authentication > Sign In / Providers > Phone**: enable it. Leave the SMS
   provider settings empty.
2. **Authentication > Hooks > Send SMS hook**: enable, type **HTTPS**, URL
   `https://<project>.supabase.co/functions/v1/send-sms`. Generate the secret,
   copy it (it starts `v1,whsec_`) into the `SEND_SMS_HOOK_SECRET` secret.

Codes are now sent through EgoSMS, the same account the website uses.

## 6. Connect WordPress

1. Upload the updated `wordpress/kandi-store-api.php` (**1.1.0**: lets
   app orders carry the points discount).
2. Upload and activate `wordpress/kandi-supabase-sync.php`.
3. **Products > App sync**: Sync URL
   `https://<project>.supabase.co/functions/v1/woo-sync`, Sync secret = your
   `KANDI_SYNC_SECRET`. Save.
4. Press **Sync everything to the app now**. Check Supabase > Table editor >
   `products`: your catalogue is there.

From then on every product you save, every stock change and every category
change reaches the app within seconds, and app orders' status comes back.

## 7. The app

Follow `flutterflow/SETUP.md`.

---

## Rewards

- Points are added when an app order is marked **Completed** in WooCommerce,
  1 point per UGX 1,000 of items (delivery not included).
- 100 points = UGX 1,000 off. Shoppers can use them from 100 points, for up
  to 50% of their items.
- Cancelled, refunded or failed orders give back points that were spent and
  take back points that were earned.
- Change the numbers in **Table editor > reward_settings**. To give a shopper
  points by hand, add a row to `points_ledger` with `reason` = `adjust`.

## Checking it works

- **WordPress > Products > App sync** shows the last message and any error.
- **Supabase > Edge Functions > (function) > Logs** shows every call.
- An app order appears in WooCommerce with "Created via: kandi-app" and the
  order note "Kandi points (N)" when points were used.
