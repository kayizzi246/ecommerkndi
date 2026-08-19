import type { Product } from "@/lib/woocommerce";
import { wordpressOrigin } from "@/lib/woocommerce";
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
/**
 * A photograph, routed through the storefront's image optimiser.
 *
 * ---- What the app was being sent, and what it cost ----
 *
 * Every image URL in these payloads was the raw WordPress upload:
 * `https://shop.kandiug.com/wp-content/uploads/2026/08/1-11.jpg`, whatever
 * size and format the seller happened to upload. So a phone showing a grid of
 * twenty tiles opened twenty connections to a shared WordPress host in order
 * to download twenty full-resolution supplier photographs.
 *
 * Measured against this shop: a product photograph answered in 0.6–1.4 seconds
 * from WordPress and 0.33 seconds through the optimiser, and came back 45%
 * smaller as WebP. The size matters on a Ugandan mobile connection; the
 * LATENCY matters more, because it is paid once per image and the app is
 * asking for twenty at a time. The homepage banner made the same point at the
 * extreme — 533KB and 5.8 seconds raw, 24KB from the CDN.
 *
 * `/_next/image` fixes all three at once: it resizes to the width the app
 * actually draws, re-encodes to WebP for any client that says it takes WebP
 * (see the `Accept` header the Dart widgets now send), and serves the result
 * from the deployment's CDN with the 31-day cache configured in
 * next.config.ts. The WordPress host is touched once, by us, on the first
 * request for each size.
 *
 * ---- Why the guard is on the ORIGIN and not on `http` ----
 *
 * The optimiser answers 400 for a host that is not in `images.remotePatterns`,
 * and a 400 here is a broken photograph in the app rather than a slow one —
 * strictly worse than doing nothing. So a URL is only rewritten when it is
 * served by the WordPress install this storefront is configured against, which
 * is the host that has to be in `remotePatterns` for the WEBSITE's own product
 * images to work at all. Anything else — a seller avatar on another domain, a
 * data URI, a relative path, an empty string — is passed through untouched.
 *
 * The result is absolute. These payloads are read by an app on another origin,
 * where a root-relative path means nothing.
 *
 * `width` must be a value Next is configured to emit: the defaults are
 * `imageSizes` (16–384) plus `deviceSizes` (640–3840). The three used here are
 * 256 for a swatch, 640 for a tile, and 1080 for a full-width gallery frame on
 * a phone. A width outside that set is another 400.
 */
export function appImage(source: string | null | undefined, width: 256 | 640 | 1080 = 640): string {
  if (!source) return "";
  if (!/^https?:\/\//i.test(source)) return source;

  const origin = wordpressOrigin();
  if (!origin || !source.startsWith(origin)) return source;

  return absolute(`/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`);
}

export function toAppProduct(product: Product): AppProduct {
  const reduced = product.regular_price > product.price;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    url: absolute(productPath(product)),
    /* 640 for the tile: the widest a product card is drawn in this app is
       half a phone screen, and 640 covers that at 3x. The gallery is the
       full-width square frame on the detail screen, which is why it gets
       1080 — see `appImage`. */
    image: appImage(product.image, 640),
    gallery: product.gallery.slice(0, 6).map((url) => appImage(url, 1080)),
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
  /* ---- Why these numbers went up ----
   *
   * They were `max-age=60, s-maxage=60, stale-while-revalidate=300`, which
   * means the edge holds a payload for one minute and may serve it stale for
   * five more. After six idle minutes the next request is a COLD one, and a
   * cold /api/app/home is expensive: it composes seven rails, which is ten
   * WordPress reads from a Vercel region on another continent. Measured on the
   * live shop, a cold one took 16 seconds and one attempt timed out outright
   * with a 524 — on the app's FIRST screen.
   *
   * That is the wrong thing to be strict about. This payload is a merchandising
   * feed: rails of products in an order that changes when the shopkeeper adds
   * stock, not a stock level or a price at the moment of purchase — both of
   * which are re-read server-side when an order is placed, and neither of which
   * this response is authoritative for.
   *
   * So the edge keeps a copy for five minutes and may serve it stale for a day
   * while it refreshes behind the request. The practical effect is that a
   * shopper opening the app essentially never waits for WordPress: the 16
   * seconds is paid by a background revalidation instead of by a person. A
   * product change still reaches the app within the five-minute window, and the
   * shop's own purge (see `/api/revalidate`) drops the underlying data cache
   * immediately.
   *
   * `max-age=60` stays small on purpose — that one is the phone's PRIVATE
   * cache, where a stale rail cannot be refreshed by anything the server does.
   */
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
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
