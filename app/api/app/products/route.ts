import { getProductsSafe, getCategories, buildCategoryTree } from "@/lib/woocommerce";
import { sortProducts, filterProducts, brandFacets } from "@/lib/sort-products";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { toAppProduct, APP_CACHE_HEADERS } from "@/lib/app-api";
import { getSiteSettings } from "@/lib/site-settings";

/**
 * The catalogue, for the app's Shop / Category screen.
 *
 * ## Why the app must not filter for itself
 *
 * The screen this feeds used to hold a hard-coded list of departments — Women,
 * Men, Kids, Beauty, Shoes, Home Decor — each with a hard-coded list of
 * subcategories, and it matched products to them by searching for substrings in
 * the category name. That has two failure modes and the shop hits both:
 *
 *   • It offers departments the catalogue does not have. Tapping "Beauty" on a
 *     shop with no beauty products gives an empty screen that reads as broken
 *     rather than as empty. This is the same bug the website's `/categories`
 *     page was built to fix.
 *   • It misses products the shop does have, because a category the owner
 *     created in wp-admin that does not happen to contain one of the expected
 *     words is invisible to the app entirely.
 *
 * The departments here are the shop's real WooCommerce terms, and filtering is
 * done by slug against the catalogue rather than by guessing at names.
 *
 * ## Why sorting happens here
 *
 * `sortProducts` and `filterProducts` are the exact functions the website's
 * category and search pages use. Sorting by price in Dart would produce a
 * different order the first time either side changed — and "Price: low to high"
 * disagreeing between app and web is the kind of thing that makes a shopper
 * think the app is lying about prices.
 *
 * ## Query parameters
 *
 *   category      Category slug. Omitted or "all" for the whole catalogue.
 *   q             Free-text search.
 *   sort          newest | price_asc | price_desc | discount | popular
 *   page          1-based. Defaults to 1.
 *   min_price     Lower bound, inclusive.
 *   max_price     Upper bound, inclusive.
 *   sale          "1" restricts to discounted products.
 *   min_discount  Whole percent. Restricts to reductions of at least this much.
 *   stock         "1" restricts to items in stock.
 */

export const revalidate = 60;

/** Matches the website's own listing pages. */
const PER_PAGE = 24;

export async function GET(request: Request) {
  const limit = rateLimit("app-products", clientIp(request), LIMITS.api);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const url = new URL(request.url);
  const params = url.searchParams;

  const categoryParam = (params.get("category") ?? "").trim();
  const category = categoryParam && categoryParam !== "all" ? categoryParam : undefined;
  const query = (params.get("q") ?? "").trim() || undefined;
  const sort = params.get("sort") ?? undefined;

  // Clamped rather than trusted. `?page=99999999` would otherwise walk the
  // WooCommerce catalogue on demand, once per request, for free.
  const page = Math.min(200, Math.max(1, Number(params.get("page")) || 1));

  const [{ products, total, total_pages }, departments, settings] = await Promise.all([
    getProductsSafe({
      category,
      search: query,
      page,
      per_page: PER_PAGE,
    }),
    // The real department list, so the app's tabs are the shop's own
    // categories rather than a guess baked into the app binary. Only those
    // with stock behind them: a tab that leads nowhere is worse than no tab.
    getCategories()
      .then(buildCategoryTree)
      .then((tree) => tree.filter((node) => (node.count ?? 0) > 0))
      .catch(() => []),
    getSiteSettings(),
  ]);

  // Facets counted before filtering, so the counts stay stable while the
  // shopper narrows down — the same order the web page does it in.
  const facets = brandFacets(products);

  const visible = sortProducts(
    filterProducts(products, {
      min_price: params.get("min_price") ?? undefined,
      max_price: params.get("max_price") ?? undefined,
      sale: params.get("sale") ?? undefined,
      // Whole percent. The app's "50% off" entry point sends this rather than
      // `sale=1`, because "reduced at all" and "half price" are different
      // promises and only one of them is on the button.
      min_discount: params.get("min_discount") ?? undefined,
      stock: params.get("stock") ?? undefined,
      brand: params.get("brand") ?? undefined,
    }),
    sort
  );

  return Response.json(
    {
      version: 1,
      // The same block the home endpoint sends, so the Shop screen can show
      // the identical trust strip without a second request. Both read the one
      // `commerce` setting the checkout charges against.
      commerce: {
        freeDeliveryFrom: settings.commerce.free_delivery_from,
        returnsDays: settings.commerce.returns_days,
        currency: "UGX",
      },
      // Echoed back so the app can tell a stale response from a current one
      // when a shopper taps through tabs faster than the network answers.
      query: {
        category: category ?? "all",
        q: query ?? "",
        sort: sort ?? "newest",
        page,
      },
      departments: departments.map((node) => ({
        id: node.id,
        name: node.name,
        slug: node.slug,
        count: node.count ?? 0,
        // Real child categories, for the subcategory chips. Empty when the
        // shop has not nested anything under this department — in which case
        // the app simply shows no chip row.
        children: node.children
          .filter((child) => (child.count ?? 0) > 0)
          .map((child) => ({
            id: child.id,
            name: child.name,
            slug: child.slug,
            count: child.count ?? 0,
          })),
      })),
      facets,
      products: visible.map(toAppProduct),
      /** Total matching the category/search before local filtering. */
      total,
      totalPages: total_pages,
      page,
      /** True when the local filters removed something from this page. */
      filtered: visible.length !== products.length,
    },
    { headers: APP_CACHE_HEADERS }
  );
}
