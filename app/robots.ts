import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/**
 * What crawlers may read, and where the sitemap is.
 *
 * The disallowed paths are the ones that either cost a shopper money to load or
 * waste the crawl budget a new domain has very little of: the cart and checkout
 * are per-visitor and never useful in a search result, and the API, admin and
 * Seller Centre are not public pages at all.
 *
 * `/search` itself stays crawlable — it is a real landing page — but query
 * strings under it are not, because a crawler following facets can generate an
 * unbounded number of near-identical URLs and spend the whole budget there.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/seller/",
          "/account/",
          "/cart",
          "/checkout",
          "/order-received",
          "/payment/",
          "/search?",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
