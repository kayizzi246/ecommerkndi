import { getProductsSafe } from "@/lib/woocommerce";

/**
 * A page of products, for the infinite grids.
 *
 * The first page is rendered on the server with the rest of the page, so the
 * shop is never empty on arrival and search engines see real products. This
 * route only serves what comes *after* that — page 2 onwards, fetched as the
 * shopper reaches the bottom.
 *
 * Two callers now: the homepage grid, which wants the whole catalogue, and the
 * "You may also like" grid at the foot of a product page, which wants the
 * category the product it is sitting under belongs to. Hence `category`.
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
   * query we build ourselves — `getProductsSafe` is the only thing that talks to
   * WordPress, and it parameterises what it sends.
   */
  const category = searchParams.get("category")?.trim() || undefined;

  /**
   * Optional sort key, checked against the list WooCommerce can actually order
   * by rather than passed through.
   *
   * The mega menu asks for `popular` to fill its "Selling fastest" strip. An
   * unrecognised value becomes `undefined` — the shop's default order — instead
   * of being forwarded to WordPress, so a crafted `?sort=` cannot reach the
   * query builder.
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
    ...(sort ? { sort } : {}),
  });

  return Response.json({ products, page, total_pages });
}
