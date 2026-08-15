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
        /**
         * `/cart` is deliberately NOT in this list any more, and that is not an
         * oversight — it is the fix for it showing up in Google.
         *
         * Blocking a URL here stops Google *reading* it; it does not stop Google
         * *indexing* it. A disallowed page that anything links to can still be
         * listed, and with the page unread the result is assembled from the link
         * alone — which is exactly what happened: `kandiug.com/cart` was ranking
         * on the brand name with a generic title, one of only four results the
         * whole domain had.
         *
         * The way to keep a page out of the index is `noindex` on the page
         * itself, and a crawler can only obey a `noindex` it is allowed to fetch.
         * So /cart is now crawlable and carries `robots: { index: false }` in its
         * own layout — Google reads it, is told to drop it, and drops it.
         *
         * The rest stay blocked: they are either not public (`/api/`, `/admin`,
         * `/seller/`, `/account/`) or per-visitor pages behind an action nothing
         * links to, so the same failure mode does not arise.
         */
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/seller/",
          "/account/",
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
