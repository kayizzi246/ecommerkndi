import type { Product } from "@/lib/woocommerce";
import { discountPercent, formatPrice } from "@/lib/currency";
import { absolute, productPath } from "@/lib/seo";

/**
 * The shape the mobile app receives a product in, and the one function that
 * produces it.
 *
 * Shared by every `/api/app/*` endpoint. It started life inside the home route
 * and moved here the moment a second endpoint needed it: two serialisers means
 * two chances to disagree about what "reduced" means or how a price is
 * formatted, and the app would then show one price on the home screen and a
 * different one on the category screen for the same product.
 *
 * Products are flattened rather than passed through raw for three reasons: the
 * payload is a fraction of the size, the app never has to reproduce the
 * discount and stock arithmetic, and internal WooCommerce fields stay internal
 * — these responses are public.
 */

export type AppProduct = {
  id: number;
  name: string;
  slug: string;
  /** Canonical web URL, so a share opens the real page. */
  url: string;
  image: string;
  gallery: string[];
  /** What the shopper pays now. */
  price: number;
  /** The struck-through price, or null when the item is not reduced. */
  wasPrice: number | null;
  /** Both prices already formatted by the shop's own `formatPrice`. */
  priceLabel: string;
  wasPriceLabel: string | null;
  /**
   * Money off, formatted — "UGX 5,000" — or null when not reduced.
   *
   * The web card prints this because "−17%" is arithmetic the shopper has to
   * do and "Save UGX 5,000" is the answer. Computed here so the app cannot
   * arrive at a different figure.
   */
  savingLabel: string | null;
  /** Whole percent off, 0 when not reduced. */
  discountPercent: number;
  inStock: boolean;
  stockQuantity: number | null;
  rating: number;
  ratingCount: number;
  totalSales: number;
  categoryName: string | null;
  categorySlug: string | null;
  sellerName: string | null;
  isNew: boolean;
};

const NEW_WINDOW_DAYS = 30;

export function isNewListing(dateCreated: string | null): boolean {
  if (!dateCreated) return false;
  return Date.now() - new Date(dateCreated).getTime() < NEW_WINDOW_DAYS * 86_400_000;
}

/**
 * Flattens one product.
 *
 * The `wasPrice` rule is the same one the web tiles use: a product is only
 * shown as reduced when the regular price is genuinely above what is being
 * charged. Anything else produces a struck-through price identical to the real
 * one, which reads as a trick.
 */
export function toAppProduct(product: Product): AppProduct {
  const reduced = product.regular_price > product.price;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    url: absolute(productPath(product)),
    image: product.image,
    gallery: product.gallery.slice(0, 6),
    price: product.price,
    wasPrice: reduced ? product.regular_price : null,
    priceLabel: formatPrice(product.price),
    wasPriceLabel: reduced ? formatPrice(product.regular_price) : null,
    savingLabel: reduced
      ? formatPrice(product.regular_price - product.price)
      : null,
    discountPercent: reduced
      ? discountPercent(product.regular_price, product.price)
      : 0,
    inStock: product.stock_status === "instock",
    stockQuantity: product.stock_quantity,
    rating: product.average_rating,
    ratingCount: product.rating_count,
    totalSales: product.total_sales,
    categoryName: product.categories[0]?.name ?? null,
    categorySlug: product.categories[0]?.slug ?? null,
    sellerName: product.seller?.store_name ?? null,
    isNew: isNewListing(product.date_created),
  };
}

/**
 * Headers for a public, cacheable app response.
 *
 * Identical for every caller, so it may be shared-cached. The
 * stale-while-revalidate window is what keeps the app feeling instant: a cold
 * client gets the last good payload immediately while a fresh one is fetched
 * behind it.
 */
export const APP_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
  // The app is not a browser and sends no Origin, but a wrapped webview build
  // might. Read-only public data, so this is safe to open up.
  "Access-Control-Allow-Origin": "*",
} as const;

/**
 * The CORS headers a WRITE endpoint the app calls has to send.
 *
 * ---- The bug this exists to fix ----
 *
 * The app priced delivery by POSTing JSON to `/api/delivery/quote`, and on the
 * FlutterFlow WEB build every one of those requests died before it reached the
 * server. The cart said "Could not price delivery. Check your connection." with
 * a perfectly good connection, and the checkout could not place an order at all.
 *
 * The reason is a preflight. A native app sends no `Origin` and CORS never
 * applies to it, which is why this went unnoticed — but a build running at
 * kandistyles.flutterflow.app IS a browser, and a cross-origin POST carrying
 * `Content-Type: application/json` is not a "simple request": the browser sends
 * an `OPTIONS` preflight first and refuses to send the POST unless that
 * preflight comes back with permission. These routes answered the preflight
 * with a 405 and no headers, so the POST was never made.
 *
 * The read-only endpoints above were already open, which is exactly why the
 * product and home screens worked while everything that WROTE anything did not
 * — a split that looks like a flaky network and is not one.
 *
 * ---- On opening these up ----
 *
 * `*` and not a list of origins, deliberately. Neither route authenticates with
 * a cookie: the quote takes a place and a subtotal and gives back a number the
 * server recalculates when the order is placed, and the checkout is a public
 * endpoint that already treats everything in its body as untrusted. There is no
 * ambient authority for a hostile page to borrow, which is the thing an origin
 * allowlist protects. And `*` cannot be combined with credentials — the browser
 * refuses — so this cannot start carrying a session later without somebody
 * having to change this line and read this note.
 *
 * `Vary: Origin` because a CDN must not hand a cached preflight for one origin
 * to another.
 */
export const APP_WRITE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  // A day. The preflight answer for these routes never changes, and paying a
  // round trip for it before every quote is most of what makes a fee feel slow
  // on a Ugandan mobile connection.
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
} as const;

/** The 204 a preflight expects. Every route the app POSTs to exports this. */
export function appPreflight(): Response {
  return new Response(null, { status: 204, headers: APP_WRITE_CORS_HEADERS });
}
