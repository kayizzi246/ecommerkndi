import type { MetadataRoute } from "next";
import { getCategories, getProductsSafe } from "@/lib/woocommerce";
import { productPath, siteUrl } from "@/lib/seo";

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
  { path: "/search", priority: 0.5, changeFrequency: "daily" },
  { path: "/sale", priority: 0.8, changeFrequency: "daily" },
  { path: "/sellers", priority: 0.5, changeFrequency: "weekly" },
  { path: "/sell", priority: 0.5, changeFrequency: "monthly" },
  { path: "/about", priority: 0.3, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.3, changeFrequency: "yearly" },
  { path: "/help", priority: 0.3, changeFrequency: "monthly" },
  { path: "/shipping", priority: 0.4, changeFrequency: "monthly" },
  { path: "/returns", priority: 0.4, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  // A shop with an unreachable backend should still publish its static pages
  // rather than serving Google an error where its sitemap should be.
  const [categories, products] = await Promise.all([
    getCategories().catch(() => []),
    getProductsSafe({ per_page: 48 }).catch(() => ({ products: [], total: 0, total_pages: 0 })),
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

    ...products.products.map((product) => ({
      url: `${base}${productPath(product)}`,
      // The product's own creation date, so a crawler can tell what is new
      // rather than seeing every URL claim to have changed this minute.
      lastModified: product.date_created ? new Date(product.date_created) : now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
