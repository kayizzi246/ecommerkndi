import { getProductsSafe } from "@/lib/woocommerce";

/**
 * A page of products, for the infinite grids.
 *
 * The first page is rendered on the server with the rest of the page, so the
 * shop is never empty on arrival and search engines see real products. This
 * route only serves what comes *after* that — page 2 onwards, fetched as the
 * shopper reaches the bottom.
 *
 * ---- Every listing grid in the shop now reads from here ----
 *
 * It used to serve two callers that both wanted the plain catalogue, so it took
 * a category and a sort and nothing else. The listing pages — /sale, /search
 * and /category — were paginated instead, and when they became infinite grids
 * they brought their own filters with them. Those filters have to be applied
 * WHERE THE PAGING HAPPENS or the two disagree: a `?on_sale` handled by the
 * page rather than by this route means page two of the sale is page two of the
 * whole catalogue, filtered down to whatever happened to be reduced.
 *
 * So each parameter below mirrors one the server pages already pass to
 * `getProductsSafe`. Nothing new is invented here; this is the same query,
 * reachable from the browser.
 *
 * ---- Everything is validated rather than forwarded ----
 *
 * `getProductsSafe` is the only thing in the shop that talks to WordPress and
 * it parameterises what it sends, so nothing here can reach a query builder as
 * text. The checks below are about not asking WooCommerce for nonsense: a
 * crafted `?per_page=100000` or `?sort=;` should be a normal answer, not an
 * error page from WordPress.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  // Capped so a crafted URL cannot ask WordPress for an unbounded page.
  const perPage = Math.min(48, Math.max(1, Number(searchParams.get("per_page")) || 24));

  /**
   * Optional category slug. Absent or empty means the whole catalogue, which is
   * what the homepage asks for.
   *
   * Passed straight to WooCommerce as a slug rather than interpolated into a
   * query we build ourselves.
   */
  const category = searchParams.get("category")?.trim() || undefined;

  /** The search term, for /search. Empty means "no term", not "match nothing". */
  const search = searchParams.get("q")?.trim() || undefined;

  /** The marketplace store slug, for a seller's own shopfront. */
  const seller = searchParams.get("seller")?.trim() || undefined;

  /** Reductions only, for /sale. Any value but `1` is ignored. */
  const onSale = searchParams.get("on_sale") === "1" ? true : undefined;

  /** In-stock only — the one filter the stock checkbox sets. */
  const inStock = searchParams.get("in_stock") === "1" ? true : undefined;

  /**
   * The price window, for the filter sidebar.
   *
   * Both are dropped unless they are finite and positive: `Number("")` is 0 and
   * `Number("abc")` is NaN, and either one forwarded as a bound would quietly
   * empty the grid rather than being ignored.
   */
  const minPrice = Number(searchParams.get("min_price"));
  const maxPrice = Number(searchParams.get("max_price"));

  /**
   * Optional sort key, checked against the list WooCommerce can actually order
   * by rather than passed through.
   *
   * An unrecognised value becomes `undefined` — the shop's default order —
   * instead of being forwarded to WordPress, so a crafted `?sort=` cannot reach
   * the query builder. `discount` is deliberately absent: it is a comparison
   * between two meta values and WooCommerce cannot order by it, so the grids
   * that offer it sort their own accumulated list.
   */
  const SORTS = ["price_asc", "price_desc", "newest", "popular", "rating"] as const;
  const requested = searchParams.get("sort");
  const sort = SORTS.includes(requested as (typeof SORTS)[number])
    ? (requested as (typeof SORTS)[number])
    : undefined;

  const { products, total_pages } = await getProductsSafe({
    page,
    per_page: perPage,
    ...(category ? { category } : {}),
    ...(search ? { search } : {}),
    ...(seller ? { seller } : {}),
    ...(onSale ? { on_sale: onSale } : {}),
    ...(inStock ? { in_stock: inStock } : {}),
    ...(Number.isFinite(minPrice) && minPrice > 0 ? { min_price: minPrice } : {}),
    ...(Number.isFinite(maxPrice) && maxPrice > 0 ? { max_price: maxPrice } : {}),
    ...(sort ? { sort } : {}),
  });

  return Response.json({ products, page, total_pages });
}
