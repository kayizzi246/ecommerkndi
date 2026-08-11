# Kandi WordPress backend

Five plugins power the Next.js storefront. Install them in this order.

| File | Purpose |
|---|---|
| `kandi-store-api.php` | Storefront read API — products, categories, reviews, shopper accounts, order creation (`kandi/v1/*`) |
| `kandi-seller-api.php` | Seller Centre — registration, email verification, approvals, seller products and photo uploads, order acceptance, commission ledger, payouts (`kandi/v1/seller/*`), the public store directory, plus the wp-admin control panel |
| `kandi-owner-api.php` | **Owner product manager** — add, edit and delete *any* product from the storefront's `/admin` screen, no seller account involved (`kandi/v1/owner/*`) |
| `kandi-storefront-settings.php` | **Logo, brand name and all promotional wording**, edited in *wp-admin → Kandi Storefront* (`kandi/v1/settings`) |
| `kandi-notifications.php` | **Branded transactional email** — shopper order receipts, and the shared template the Seller Centre sends verification codes and order alerts through. Optional but recommended; without it the other plugins fall back to plain-text `wp_mail` |

All but the settings plugin require WooCommerce. `kandi-owner-api.php` is optional and
independent — the storefront works without it, you just lose the `/admin` screen.

## 1. Install

Upload each file into its own folder under `wp-content/plugins/`:

```
wp-content/plugins/kandi-store-api/kandi-store-api.php
wp-content/plugins/kandi-seller-api/kandi-seller-api.php
wp-content/plugins/kandi-owner-api/kandi-owner-api.php
wp-content/plugins/kandi-storefront-settings/kandi-storefront-settings.php
```

Then activate **Kandi Store API**, **Kandi Seller Centre**, **Kandi Owner API** and
**Kandi Storefront Settings** in *wp-admin → Plugins*.

Activating the Seller Centre creates the seller role and two tables:

- `wp_kandi_commissions` — one row per seller-owned order line item
- `wp_kandi_payouts` — payout requests

(If you paste the code into the Code Snippets plugin instead, the tables are created on the
next page load — no activation hook needed.)

## 2. Share the API secret

Add to `wp-config.php`, above the "That's all, stop editing" line:

```php
define( 'KANDI_API_SECRET', 'a-long-random-string' );
```

Put the same value in the storefront's `.env.local`:

```
WP_API_URL=https://your-site.com/wp-json/kandi/v1
KANDI_API_SECRET=a-long-random-string
```

Every seller request carries this secret in `X-Kandi-Secret`, so only your storefront can
reach the seller endpoints.

### …or configure everything in wp-admin instead

If editing `wp-config.php` is awkward, **wp-admin → Kandi Storefront → Storefront connection**
holds all three values the shop needs, and nothing else has to be edited by hand:

| Field | What it does |
|---|---|
| **Storefront URL** | Where the Next.js shop lives, e.g. `https://shop.kandiug.com`. Fill this in and **products you delete or edit in WordPress disappear from the shop immediately** — see below. |
| **Storefront API secret** | Same value as `KANDI_API_SECRET` in `.env.local`. |
| **Owner passcode** | Unlocks `/admin`, the owner product manager. Blank means owner access stays off. |

A `KANDI_API_SECRET` (or `KANDI_OWNER_PASSCODE`) constant in `wp-config.php` still wins over
the field — the constant is the more secure home, because it is not in the database and not
editable from wp-admin. The secrets are stored in their own options, never in the public
`/wp-json/kandi/v1/settings` response.

### Why deleted products used to stay on the shop

The storefront caches product reads for a minute, which is what makes it fast. Nothing told it
when the catalogue changed, so a product deleted in wp-admin went on showing until that minute
expired — and a prerendered page could hold it longer still.

With **Storefront URL** set, WordPress now pings `POST /api/revalidate` on every product save,
trash, untrash and delete, and the shop drops its cached catalogue on the spot. The ping is
non-blocking and carries the shared secret, so saving a product never waits on the storefront
and nobody else can trigger a purge.

If products still look stale, check in this order: the URL is exactly the shop's own origin
with no trailing slash; the secret here matches `.env.local`; and the shop is reachable from
the WordPress server.

## 2b. Owner passcode (the `/admin` product manager)

The Seller Centre can only ever see one seller's listings: every query it runs filters on the
`_kandi_seller_id` meta, and only an *approved* seller may create a listing at all. Products you
added yourself in wp-admin carry no such meta, which is why they never appear there and cannot
be edited or deleted from it.

`kandi-owner-api.php` is the way in for you, the shop owner. Add a second secret to
`wp-config.php`:

```php
define( 'KANDI_OWNER_PASSCODE', 'a-long-random-passcode-only-you-know' );
```

Then open **`https://your-storefront/admin`**, type that passcode once, and you get a screen
listing *every* product in the shop — yours and your sellers' — where you can:

- **add** a product, which goes live immediately (no approval queue: you are the approver)
- **edit** name, prices, stock, photos, category, sizes and colours on any product
- **publish or hide** any listing
- **delete** any listing (it goes to the WordPress trash, so past orders keep their record)

Two things guard those endpoints: the shared `X-Kandi-Secret`, which never leaves your
storefront's server, and the passcode, which the storefront keeps in an httpOnly cookie the
browser's JavaScript cannot read. Leave `KANDI_OWNER_PASSCODE` undefined and the whole owner
API refuses every request, so an unused install is not an open door.

Every write also clears the storefront's product cache, so an added, edited or deleted product
shows on the shop on the next page load rather than up to a minute later.

## 3. Configure

*wp-admin → Kandi Sellers → Settings*:

- **Default commission rate** — applied to new sellers (existing sellers keep their own rate)
- **New listings** — leave unchecked to review seller products before they go live
- **Storefront API secret** — only shown when the `wp-config.php` constant is absent

## How the money flows

1. A shopper orders. When the order reaches `processing`, one `wp_kandi_commissions` row is
   written per line item that belongs to a seller, at that seller's rate. Rows are keyed on
   `order_item_id`, so replays are harmless.
2. Rows sit at `pending` until the order is marked `completed`, when they become `payable`.
   Cancelled, refunded and failed orders flip their rows to `cancelled` and drop out of every
   total.
3. The seller requests a payout once they have `payable` earnings.
4. *Kandi Sellers → Payouts → Mark paid* settles the request and closes every `payable` row
   for that seller as `paid`.

## Admin screens

| Screen | What it does |
|---|---|
| Sellers | Approve / reject / suspend stores, set per-seller commission rates, see gross sales and commission owed |
| Product Approvals | Publish or send back listings sellers have submitted |
| Commissions | Marketplace totals and a per-seller breakdown |
| Payouts | Approve and settle payout requests |
| Settings | Default rate, auto-approval, API secret |

Sellers are redirected out of wp-admin to `/seller` — the Seller Centre is their only interface.

## Endpoints

Public (secret only): `POST /seller/register`, `POST /seller/login`, `POST /seller/logout`

Authenticated (secret + `Authorization: Bearer <token>`):

```
GET    /seller/me
PUT    /seller/settings
GET    /seller/stats?range=7d|30d|90d|mtd|ytd
GET    /seller/products
POST   /seller/products
PUT    /seller/products/{id}
DELETE /seller/products/{id}
GET    /seller/orders?status=any|processing|completed|…
GET    /seller/commissions?range=…
POST   /seller/payouts
POST   /seller/media                 ← multipart/form-data, field name "file"
POST   /seller/orders/{id}/accept
```

Public (secret only), added with email verification:

```
POST /seller/verify            { email, code }  → returns a session
POST /seller/verify/resend     { email }
POST /seller/google            { email, google_id }
```

## Email

Every message below goes through `wp_mail`, so whatever SMTP plugin the site
already uses carries them. **If WordPress cannot send mail, none of this works** —
test with any SMTP plugin's "send test email" button before blaming the code.

| Trigger | Who gets it |
|---|---|
| Seller registers | Seller — six-digit code, valid 30 minutes. Marketplace team — a store is waiting |
| Order reaches processing / on-hold | Shopper — receipt with items, total and how to pay. Each seller — only their own lines, plus the delivery address |
| Seller accepts their part | Shopper — "being packed". Seller — their packing list |
| Order completed | Shopper — delivered, with the returns window |
| Order cancelled | Shopper — cancelled, not charged |
| Seller requests a payout | Seller — confirmation. Marketplace team — a request to settle |
| Payout marked paid in wp-admin | Seller — the money is on its way |

Shopper messages check whether the matching **WooCommerce** email is enabled
first and stay quiet if it is, so nobody is told twice. Turn a WooCommerce email
off under *WooCommerce → Settings → Emails* and Kandi's version takes over.

Mail is sent from `no-reply@<your-domain>` — not from a Gmail support address,
which the big providers treat as forgery and bin. Filter `kandi_mail_from_address`
to change it.

## Email verification

New seller accounts are created unverified and cannot sign in until the emailed
code is entered; the storefront shows the code screen automatically, on both
sign-up and sign-in. Signing in with Google verifies the address outright, since
Google has already proved it.

Accounts that existed before this was added are treated as verified, so updating
the plugin does not lock out sellers who are already trading.

## Abuse control

Fixed-window limits, counted in transients, on everything reachable without a
session:

| Endpoint | Limit |
|---|---|
| `POST /seller/login` | 8 per email and 30 per IP, per 15 minutes |
| `POST /seller/register` | 10 per IP, per 15 minutes |
| `POST /seller/verify` | 30 per IP, per 15 minutes, and 5 guesses per code |
| `POST /seller/verify/resend` | 3 per address, per 15 minutes |
| `POST /seller/google` | 30 per IP, per 15 minutes |

Login answers the same way for a wrong password and an unknown address, and
resend answers the same way whether or not the address has an account — both
would otherwise be ways to find out who sells here. A successful sign-in clears
that address's bucket.

The storefront sends `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` and `Strict-Transport-Security` on every
response, and hides its framework version.

### Photo uploads (`POST /seller/media`)

Sellers upload product photographs straight from a phone or laptop; the file lands in the
WordPress media library and the URL that comes back is submitted with the listing as an
entry in `image_urls`. JPEG, PNG, WebP and GIF, 8 MB a file, eight photos a listing. The
type is checked by reading the file's bytes, not its name, and each attachment is stamped
with `_kandi_seller_id` so you can see in wp-admin who uploaded what.

**This endpoint arrived after the first release.** If the Seller Centre shows
*"Photo uploads are not switched on yet"*, or the WordPress log records `rest_no_route`,
the copy of `kandi-seller-api.php` on the server predates it — re-upload the current file
to `wp-content/plugins/kandi-seller-api/` (or paste it over the Code Snippets snippet) and
the endpoint appears immediately. No re-activation, no database change.

To check which version is live, open `https://your-site.com/wp-json/kandi/v1` and look for
`/kandi/v1/seller/media` in the route list.

Tokens last 14 days and are stored as WordPress transients. The browser never sees one —
the Next.js route handlers under `app/api/seller/` keep it in an httpOnly cookie and attach
it server-side.

## Shopper accounts and reviews (`kandi-store-api.php`)

Shoppers sign in with Google. The storefront verifies the ID token with Google, then calls
these endpoints; the same shared secret gates all of them, and a shopper token (30 days,
also a transient) authorises the ones that touch a specific account.

Public: `GET /products/{id}/reviews`

Secret only: `POST /customers/google`, `POST /customers/logout`

Secret + `Authorization: Bearer <shopper token>`:

```
GET  /customers/me
PUT  /customers/preferences
GET  /customers/orders        order history for the account dashboard
GET  /customers/reviews       every review this shopper wrote
POST /products/{id}/reviews   write or update a review (rating 1–5 + text)
```

**Reviews are stored as WooCommerce reviews** — comments of type `review` on the product,
with the star rating in the `rating` comment meta. That means they show up in
*wp-admin → Products → Reviews*, count towards the product's average rating, and are
readable by any theme or plugin. Nothing lives only in the Next.js app.

A shopper gets one review per product: posting again edits the existing one.
`verified` is set from `wc_customer_bought_product()`, so the "Verified purchase" badge is
only shown when the account really has an order containing that product.

> After updating `kandi-store-api.php`, re-upload it to `wp-content/plugins/kandi-store-api/`
> (or re-paste the snippet). The review, order-history and rating endpoints do not exist on
> older copies, and the storefront will show empty review sections until they do.

## Changing the logo and the promo wording (`kandi-storefront-settings.php`)

Go to **wp-admin → Kandi Storefront**. Nothing here needs a developer or a redeploy — the
storefront re-reads these values every 60 seconds.

| Section | Controls |
|---|---|
| Logo and brand | The logo image (from the media library), the brand name shown when no logo is set, the tagline |
| Promotional wording | The green top strip, its link, the **animated rotating line**, and the big homepage banner |
| Contact details | Phone, email, WhatsApp, opening hours, address — used on `/contact`, the footer and the policy pages |
| Mobile apps | The **App is live** toggle plus the App Store and Google Play URLs |
| Seller terms | Joining fee, default commission, payout frequency, and the number sellers pay the fee to |
| Social links | Facebook, Instagram, TikTok, X. Blank ones are hidden rather than linking nowhere |
| Commercial terms | Free-delivery threshold and returns window, quoted automatically everywhere they appear |

Endpoint: `GET /wp-json/kandi/v1/settings` (public, read-only — it is branding, not private data).

Every field falls back to the shipped wording when left blank, and the storefront falls back to
the same defaults if WordPress is unreachable, so branding can never take a page down.

> The rotating line is for promises you actually keep. Invented stock counts and fake countdown
> timers breach consumer-protection rules in most markets and cost you repeat customers.

### Turning the app badges on

The App Store and Google Play badges are always in the footer. They have two states:

- **Coming soon** (the default) — greyed out, marked *Soon*, and not clickable.
- **Live** — a real link that opens the store listing in a new tab.

To flip them: paste the store URL(s) into *Mobile apps*, tick **App is live**, and save. The
toggle only takes effect when at least one URL is filled in, and each badge is judged
separately — so you can launch on Android first and the Apple badge stays on "coming soon"
by itself.

> The badge artwork in `components/AppStoreBadges.tsx` is drawn inline as a faithful stand-in.
> Apple and Google both require their own supplied badge files on public sites, with set
> minimum sizes and clear space. Download the official assets from Apple's Marketing Resources
> and Google's Play Badge Generator and swap them in before you announce the app.

## Seller joining fee

New sellers are charged a one-off registration fee (default UGX 50,000, editable under
*Kandi Storefront → Seller terms*). **There is no payment gateway in onboarding** — the money
arrives by mobile money and a human confirms it:

1. The seller finishes onboarding. Their account is created with `_kandi_fee_status = unpaid`
   and a reference of the form `KND-0042`.
2. The confirmation screen — and a banner on every Seller Centre page — gives them the amount,
   the number from *Seller terms*, and that reference.
3. When the payment lands, open *wp-admin → Kandi Sellers* and press **Mark paid** on their row.
   That emails them automatically and clears the banner.
4. Approve the store as normal.

Set the fee to `0` and the whole payment step disappears from onboarding, the banner never
shows, and existing sellers are recorded as `waived`.

> The fee amount is copied onto the seller's record at the moment they apply, so raising the
> fee later never changes what someone already in the queue was told to pay.

## Public store directory (`kandi-seller-api.php`)

`GET /wp-json/kandi/v1/stores` lists approved sellers — store name, slug, logo and product count,
and nothing private. It powers `/sellers` on the storefront. Each store's own page uses
`GET /wp-json/kandi/v1/products?seller={store-slug}`.

### Storefront Google client ID

Sign-in also needs an OAuth Web client ID in the storefront's `.env.local`:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Create it at <https://console.cloud.google.com/apis/credentials> and add your storefront
origins (e.g. `http://localhost:3000` and the live domain) under *Authorised JavaScript
origins*. Without it the sign-in button, the `/account` dashboard and writing reviews are
all unavailable.
