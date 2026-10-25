import { getCurrentPrices } from "@/lib/woocommerce";

/**
 * Current price and stock for up to 12 products: `?ids=12,34,56`.
 *
 * Read by the homepage "Welcome back" panel to tell a returning shopper which
 * of the things they looked at have since dropped in price or gone on sale.
 * Ids are validated rather than forwarded, and the list is capped so a crafted
 * URL cannot ask WordPress for the whole catalogue.
 */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 12);

  const prices = await getCurrentPrices([...new Set(ids)]);
  return Response.json(
    { prices },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400" } }
  );
}
