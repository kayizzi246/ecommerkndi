/**
 * What counts as a store address, in one place.
 *
 * A store answers at two paths — /sellers/<slug> and the short /<slug> a seller
 * actually shares — and three different things need to agree about that:
 *
 *   • `app/[store]/page.tsx`, which decides whether a single-segment path is a
 *     store or a 404;
 *   • `StoreChrome`, which drops the department bar and the shell width cap on
 *     a store page;
 *   • WordPress, which refuses to issue a slug that collides with a real route.
 *
 * The first two read this file. The third has its own copy, in
 * `kandi_reserved_store_slugs()`, because it runs on a different machine in a
 * different language — and it is the one that decides, since it is the only one
 * that can stop a bad slug existing in the first place. This list only has to
 * be a superset of the shop's routes; if it drifts, the failure is a store page
 * rendering inside the shell cap, not a broken address.
 *
 * ---- Why this was worth extracting ----
 *
 * The short route shipped and store pages kept their shell cap, because
 * `StoreChrome` was still looking for `/sellers/` and a seller's own link does
 * not contain it. Two independent answers to "is this a store page?" is what
 * produced that, and it is the kind of split that will not stay fixed by
 * remembering.
 */

/** Top-level paths the shop owns, which can never be a store. */
export const RESERVED_SLUGS = new Set([
  "about", "account", "admin", "api", "careers", "cart", "categories",
  "category", "checkout", "contact", "help", "order-received", "payment",
  "privacy", "products", "reset-password", "returns", "sale", "search",
  "sell", "seller", "seller-policies", "sellers", "shipping", "terms",
  "track-order", "wp-admin", "wp-json", "wp-content", "assets", "static",
  "_next", "favicon.ico", "robots.txt", "sitemap.xml", "icon.png",
  "brand-icon", "opengraph-image",
]);

/**
 * The store slug a path refers to, or "" when it is not a store page.
 *
 * Answers for both shapes. Deliberately does NOT check whether the store
 * exists: that needs a fetch, and both callers only use this to choose a
 * layout. A path that looks like a store and is not renders the 404 page
 * full-width, which nobody will ever notice.
 */
export function storeSlugFromPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, "");

  if (path.startsWith("/sellers/")) {
    const slug = path.slice("/sellers/".length);
    return slug && !slug.includes("/") ? slug : "";
  }

  const segment = path.startsWith("/") ? path.slice(1) : path;

  if (
    segment === "" ||
    segment.includes("/") ||
    // A dot means a file request that reached the router — a stray asset path,
    // a probe for wp-config.php — and never a store.
    segment.includes(".") ||
    RESERVED_SLUGS.has(segment.toLowerCase())
  ) {
    return "";
  }

  return segment;
}

/**
 * A store slug rendered as the name a seller would recognise.
 *
 * Title-cased from the slug rather than fetched, because the one caller is a
 * search-field placeholder in the chrome and a round trip for a line of grey
 * text is not worth it. WordPress builds slugs with `sanitize_title(store_name)`,
 * so "Sports Kicks" round-trips exactly; a store with its own internal casing
 * comes back conventionally cased.
 */
export function storeNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
