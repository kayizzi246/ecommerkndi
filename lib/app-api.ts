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
