# Kandi WordPress backend

Two plugins power the Next.js storefront. Install them in this order.

| File | Purpose |
|---|---|
| `kandi-store-api.php` | Storefront read API — products, categories, order creation (`kandi/v1/*`) |
| `kandi-seller-api.php` | Seller Centre — registration, approvals, seller products, commission ledger, payouts (`kandi/v1/seller/*`) plus the wp-admin control panel |

Both require WooCommerce.

## 1. Install

Upload each file into its own folder under `wp-content/plugins/`:

```
wp-content/plugins/kandi-store-api/kandi-store-api.php
wp-content/plugins/kandi-seller-api/kandi-seller-api.php
```

Then activate **Kandi Store API** and **Kandi Seller Centre** in *wp-admin → Plugins*.

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
reach the seller endpoints. If you'd rather not edit `wp-config.php`, leave the constant out
and set the secret in *Kandi Sellers → Settings*.

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
```

Tokens last 14 days and are stored as WordPress transients. The browser never sees one —
the Next.js route handlers under `app/api/seller/` keep it in an httpOnly cookie and attach
it server-side.
