# Product views — what the WordPress plugin has to add

The storefront half is built and deployed. Nothing in it works until the plugin
answers the two endpoints below, and nothing in it *breaks* while the plugin
does not: the write is fire-and-forget, and the dashboard hides the views tile
whenever `views` is absent from the stats payload.

That is the property to preserve when implementing this. **Absent means "not
measured"; zero means "measured, nobody looked."** A plugin that returns `0`
before it has counted anything will tell every seller their listings are dead.

---

## 1. `POST /wp-json/kandi/v1/product-views`

Called server-side by the storefront, once per shopper per product per session.

### Request

```
POST /wp-json/kandi/v1/product-views
Content-Type: application/json
X-Kandi-Secret: <KANDI_API_SECRET>

{ "product_id": 1234 }
```

### Authentication

The shared secret, exactly as the seller endpoints check it. **Reject anything
without it**, with 401. This is the whole security model of the counter: a
public, unauthenticated increment is a number a seller can type into, and a
number a seller can inflate is worse than no number, because they will believe
it and price against it.

The browser never holds this secret — it posts to `/api/products/view` on the
storefront, which is what calls this. See `app/api/products/view/route.ts`.

### Behaviour

- Increment a per-product, per-day counter. Per-day, not a single lifetime
  total, because every figure on the dashboard is scoped to the range the
  seller picked, and a lifetime counter cannot answer "this week".
- Ignore an unknown or non-`product` post id. Do not create anything.
- Respond `204` with no body. The caller discards the response either way, so
  do not spend a query building one.

### Suggested storage

```php
// One row per product per day. `views` is the only mutable column.
CREATE TABLE {$wpdb->prefix}kandi_product_views (
  product_id BIGINT UNSIGNED NOT NULL,
  view_date  DATE            NOT NULL,
  views      INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, view_date)
);
```

```php
$wpdb->query( $wpdb->prepare(
  "INSERT INTO {$table} (product_id, view_date, views) VALUES (%d, %s, 1)
   ON DUPLICATE KEY UPDATE views = views + 1",
  $product_id,
  current_time( 'Y-m-d' )
) );
```

**Not post meta.** A `_kandi_views` meta field would be one autoloaded row
growing on every page view of every product, updated on a write path that runs
more often than any other in the shop — and it cannot be grouped by date without
storing a serialised array and rewriting the whole thing per view.

A dedicated table with a composite primary key makes the write a single upsert
with no read first, and makes the range query below an index scan.

### Retention

Nothing here needs to be kept forever. A monthly cron dropping rows older than
about 400 days keeps the table small and still leaves a full year-on-year
comparison available.

---

## 2. Two new fields on `GET /wp-json/kandi/v1/seller/stats`

The endpoint already exists and already scopes everything to `?range=`. These
join it, scoped the same way:

```jsonc
{
  // …everything already returned…

  // Total views of this seller's products in the selected range.
  "views": 4821,

  // Percentage change against the immediately preceding range of equal length,
  // signed, same convention as revenue_change and orders_change.
  "views_change": 12.4,

  "top_products": [
    {
      "id": 1234,
      "name": "…",
      "units": 12,
      "revenue": 480000,
      // Views of THIS product, in the same range.
      "views": 310
    }
  ]
}
```

### The rule about absence, again

Emit `views` and `views_change` **only once the table exists and the counter is
live**. While the counter is not running, leave both fields out entirely — the
dashboard then renders exactly as it does today, four tiles and no views column,
which is the truth.

The same applies per product: omit `views` inside a `top_products` entry rather
than sending `0`, if the product predates the counter.

### Query shape

```sql
SELECT SUM(views) AS views
FROM {prefix}kandi_product_views v
JOIN {prefix}posts p ON p.ID = v.product_id
WHERE p.post_author = %d
  AND v.view_date BETWEEN %s AND %s
```

(with whatever this plugin already uses to resolve a seller to their products —
if listings are attributed by a store term rather than `post_author`, use that
instead; the point is only that the range and the seller both narrow it.)

---

## What the storefront already does

| Piece | File | Behaviour |
| --- | --- | --- |
| Ping | `components/ProductViewPing.tsx` | Fires after paint, once per product per tab (`sessionStorage`), `keepalive` so it survives navigation. |
| Route | `app/api/products/view/route.ts` | Drops bot user-agents, rate-limits per IP, forwards with the shared secret, always answers `202`. |
| Types | `lib/seller.ts` | `views?`, `views_change?`, `top_products[].views?` — all optional. |
| Dashboard | `app/seller/page.tsx` | Views tile with a view→order conversion hint; hidden while `views` is undefined. |
| Best sellers | `components/seller/TopProductsChart.tsx` | Adds "N views · X% bought" to the hover card when present. |

## What is deliberately not counted

- **Crawlers.** Googlebot executes JavaScript, so an unfiltered counter measures
  Google rather than shoppers. Filtered by user-agent in the route.
- **Repeat views in one session.** A shopper going back and forth between a
  listing and its photographs is one view, not ten.
- **App views.** The FlutterFlow app reads `/api/app/product/{id}` and does not
  ping this endpoint. Worth adding later — it is one call in
  `product_detail_widget.dart` — but it should be a deliberate decision, because
  until it is made the figure means "views on the website", and the dashboard
  should not imply otherwise.
