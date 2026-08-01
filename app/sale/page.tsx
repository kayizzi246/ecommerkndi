import Link from "next/link";
import { getProductsSafe } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";
import FlashSaleCountdown from "@/components/FlashSaleCountdown";

export const metadata = { title: "Flash Deals" };

export default async function SalePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { page: pageParam, sort: sortParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { products, total, total_pages } = await getProductsSafe({
    on_sale: true,
    page,
    per_page: 24,
  });

  // Simulated sorting
  let sortedProducts = [...products];
  switch (sortParam) {
    case "price_asc":
      sortedProducts.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      sortedProducts.sort((a, b) => b.price - a.price);
      break;
    case "discount":
      sortedProducts.sort((a, b) => {
        const aPct = a.regular_price > 0 ? ((a.regular_price - a.price) / a.regular_price) * 100 : 0;
        const bPct = b.regular_price > 0 ? ((b.regular_price - b.price) / b.regular_price) * 100 : 0;
        return bPct - aPct;
      });
      break;
    default:
      break;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-4 pb-24 lg:pb-8">
      {/* Sale Hero */}
      <div className="bg-gradient-to-r from-market to-market-dark rounded-xl p-6 md:p-8 mb-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#ffe2a8]">🔥 Limited time</p>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-1">Flash Deals</h1>
            <p className="text-sm text-white/80 mt-2">{total} products on sale</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-lg px-6 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wider font-medium">Ends in</p>
            <p className="font-heading text-xl font-bold">
              <FlashSaleCountdown />
            </p>
          </div>
        </div>
      </div>

      {/* Sort bar */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          Showing {sortedProducts.length} of {total} deals
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 hidden sm:inline">Sort:</span>
          <form method="GET" className="flex items-center gap-2">
            <select
              name="sort"
              defaultValue={sortParam || ""}
              onChange={(e) => {
                const url = new URL(window.location.href);
                if (e.target.value) url.searchParams.set("sort", e.target.value);
                else url.searchParams.delete("sort");
                url.searchParams.delete("page");
                window.location.href = url.toString();
              }}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-market cursor-pointer"
            >
              <option value="">Best Match</option>
              <option value="discount">Biggest Discount</option>
              <option value="price_asc">Price Low → High</option>
              <option value="price_desc">Price High → Low</option>
            </select>
          </form>
        </div>
      </div>

      {sortedProducts.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-600">
          <p className="font-semibold mb-3">No sale items right now</p>
          <Link href="/" className="text-sm text-market font-semibold hover:underline">
            ← Back to shop
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {total_pages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-10">
              {page > 1 && (
                <Link
                  href={`/sale?page=${page - 1}${sortParam ? `&sort=${sortParam}` : ""}`}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:border-market transition-colors"
                >
                  ← Previous
                </Link>
              )}
              <span className="text-sm text-gray-500">
                Page {page} / {total_pages}
              </span>
              {page < total_pages && (
                <Link
                  href={`/sale?page=${page + 1}${sortParam ? `&sort=${sortParam}` : ""}`}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:border-market transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

