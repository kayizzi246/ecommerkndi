import Link from "next/link";
import { getProductsSafe } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";
import SortDropdown from "@/components/SortDropdown";
import FilterSidebar from "@/components/FilterSidebar";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string; min_price?: string; max_price?: string; rating?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam, sort: sortParam, min_price, max_price, rating } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { products, total, total_pages } = await getProductsSafe({
    category: slug,
    page,
    per_page: 24,
  });

  // Client-side simulated sorting (since API has limited sort)
  let sortedProducts = [...products];
  switch (sortParam) {
    case "price_asc":
      sortedProducts.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      sortedProducts.sort((a, b) => b.price - a.price);
      break;
    case "newest":
      sortedProducts.sort((a, b) => {
        if (!a.date_created) return 1;
        if (!b.date_created) return -1;
        return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
      });
      break;
    default:
      break;
  }

  const title = slug.replace(/-/g, " ");

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-4 pb-24 lg:pb-8">
      {/* Breadcrumbs */}
      <nav className="text-xs text-gray-500 mb-4">
        <Link href="/" className="hover:text-market">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-800 font-medium capitalize">{title}</span>
      </nav>

      <div className="flex items-start gap-6">
        {/* Sidebar — desktop only */}
        <div className="hidden lg:block w-56 shrink-0">
          <FilterSidebar />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold capitalize">{title}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{total} products</p>
            </div>
            <SortDropdown />
          </div>

          {/* Mobile filter button */}
          <div className="lg:hidden mb-4">
            <details className="group">
              <summary className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium cursor-pointer hover:border-market transition-colors">
                <span>Filters & Sorting</span>
                <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-3">
                <div className="mb-4">
                  <SortDropdown />
                </div>
                <FilterSidebar />
              </div>
            </details>
          </div>

          {sortedProducts.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-600">
              <p className="font-semibold mb-2">Nothing in this category yet.</p>
              <Link href="/" className="text-market font-semibold hover:underline">
                ← Back to shop
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {sortedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {total_pages > 1 && (
                <div className="flex justify-center items-center gap-3 mt-10">
                  {page > 1 && (
                    <Link
                      href={`/category/${slug}?page=${page - 1}${sortParam ? `&sort=${sortParam}` : ""}`}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:border-market transition-colors"
                    >
                      ← Previous
                    </Link>
                  )}
                  <span className="text-sm text-gray-500">
                    Page {page} of {total_pages}
                  </span>
                  {page < total_pages && (
                    <Link
                      href={`/category/${slug}?page=${page + 1}${sortParam ? `&sort=${sortParam}` : ""}`}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:border-market transition-colors"
                    >
                      Next →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
