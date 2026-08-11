import type { MetadataRoute } from "next";
import { getCategories, getProductsSafe, getStores } from "@/lib/woocommerce";
import { productPath, siteUrl } from "@/lib/seo";
import type { Product } from "@/lib/woocommerce";

/**
 * The sitemap, built from the live catalogue.
 *
 * Without one, Google finds a new shop's products only by crawling links from
 * the homepage — which on a storefront this size means the deeper products may
 * take weeks to appear, or never. This lists every published product and
 * category the moment it exists.
 *
 * Regenerated hourly rather than on every request: a crawler hitting this can
 * otherwise walk the whole WooCommerce catalogue on each visit.
 */
export const revalidate = 3600;

/** Static pages worth indexing, with a rough sense of their relative weight. */
const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/sale", priority: 0.8, changeFrequency: "daily" },
  { path: "/sellers", priority: 0.5, changeFrequency: "weekly" },
  { path: "/sell", priority: 0.5, changeFrequency: "monthly" },
  { path: "/about", priority: 0.3, changeFrequency: "yearly" },
  { path: "/careers", priority: 0.2, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.3, changeFrequency: "yearly" },
  { path: "/help", priority: 0.3, changeFrequency: "monthly" },
  { path: "/shipping", priority: 0.4, changeFrequency: "monthly" },
  { path: "/returns", priority: 0.4, changeFrequency: "monthly" },
  { path: "/seller-policies", priority: 0.2, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
];
// `/search` is deliberately absent: it now carries `noindex`, and listing a
// page in the sitemap while telling Google not to index it is a contradiction
// that shows up as an error in Search Console.

/** Stops a catalogue of any size from producing a sitemap of unbounded length. */
const MAX_PRODUCTS = 5000;
const PAGE_SIZE = 100;

/**
 * Every published product, not just the first page of them.
 *
 * This used to ask for one page of 48 and stop, which was invisible while the
 * shop was small and would have quietly hidden the 49th product onwards from
 * Google for as long as nobody thought to check. It now walks the pages until
 * WooCommerce runs out.
 */
async function allProducts(): Promise<Product[]> {
  const first = await getProductsSafe({ per_page: PAGE_SIZE }).catch(() => null);
  if (!first) return [];

  const products = [...first.products];
  const pages = Math.min(first.total_pages || 1, Math.ceil(MAX_PRODUCTS / PAGE_SIZE));

  // Sequential rather than parallel: this runs hourly at most, and a burst of
  // twenty simultaneous catalogue reads is a good way to be rate-limited by a
  // shared host mid-sitemap.
  for (let page = 2; page <= pages; page++) {
    const next = await getProductsSafe({ per_page: PAGE_SIZE, page }).catch(() => null);
    if (!next || next.products.length === 0) break;
    products.push(...next.products);
  }

  return products;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  // A shop with an unreachable backend should still publish its static pages
  // rather than serving Google an error where its sitemap should be.
  const [categories, products, stores] = await Promise.all([
    getCategories().catch(() => []),
    allProducts(),
    getStores().catch(() => []),
  ]);

  return [
    ...STATIC_PAGES.map((page) => ({
      url: `${base}${page.path}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),

    ...categories
      .filter((category) => (category.count ?? 0) > 0)
      .map((category) => ({
        url: `${base}/category/${category.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),

    // One page per marketplace store. These rank for the store's own name,
    // which is often how a seller's existing customers look for them.
    ...stores
      .filter((store) => store.store_slug && store.product_count > 0)
      .map((store) => ({
        url: `${base}/sellers/${store.store_slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),

    ...products.map((product) => ({
      url: `${base}${productPath(product)}`,
      // The product's own creation date, so a crawler can tell what is new
      // rather than seeing every URL claim to have changed this minute.
      lastModified: product.date_created ? new Date(product.date_created) : now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
