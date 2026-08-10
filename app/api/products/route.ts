import { getProductsSafe } from "@/lib/woocommerce";

/**
 * A page of products, for the homepage's infinite scroll.
 *
 * The first page is rendered on the server with the rest of the page, so the
 * shop is never empty on arrival and search engines see real products. This
 * route only serves what comes *after* that — page 2 onwards, fetched as the
 * shopper reaches the bottom.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  // Capped so a crafted URL cannot ask WordPress for an unbounded page.
  const perPage = Math.min(48, Math.max(1, Number(searchParams.get("per_page")) || 24));

  const { products, total_pages } = await getProductsSafe({ page, per_page: perPage });

  return Response.json({ products, page, total_pages });
}
