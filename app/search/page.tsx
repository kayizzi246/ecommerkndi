import Link from "next/link";
import { getProductsSafe } from "@/lib/woocommerce";
import { sortProducts, filterProducts, brandFacets } from "@/lib/sort-products";
import ProductCard from "@/components/ProductCard";
import SortDropdown from "@/components/SortDropdown";
import FilterSidebar from "@/components/FilterSidebar";
import Pagination from "@/components/Pagination";

type Search = {
  q?: string;
  page?: string;
  sort?: string;
  min_price?: string;
  max_price?: string;
  stock?: string;
  sale?: string;
  brand?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const search = await searchParams;
  const { q = "", page: pageParam, sort } = search;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = q.trim();

  const { products, total, total_pages } = query
    ? await getProductsSafe({ search: query, page, per_page: 24 })
    : { products: [], total: 0, total_pages: 0 };

  const brands = brandFacets(products);
  const visible = sortProducts(filterProducts(products, search), sort);
  const filtered = visible.length !== products.length;

  return (
    <main className="w-full px-4 pb-24 pt-4 md:px-8 lg:pb-12">
      <nav className="mb-5 flex items-center gap-2 text-[12px] text-shop-muted">
        <Link href="/" className="hover:text-shop-ink">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="text-shop-ink">Search results</span>
      </nav>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Filter rail */}
        <div className="order-first w-full flex-none md:w-56 lg:w-64">
          <div className="hidden md:sticky md:top-32 md:block">
            <FilterSidebar brands={brands} />
          </div>

          <details className="group rounded-lg border border-shop-line bg-white md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-semibold text-shop-ink">
              Filters
              <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="px-4 pb-4">
              <FilterSidebar brands={brands} />
            </div>
          </details>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-shop-line pb-4">
            <div>
              <h1 className="text-[26px] font-semibold text-shop-ink md:text-[30px]">
                {query ? `“${query}”` : "Search"}
              </h1>
              <p className="mt-1 text-[13px] text-shop-muted">
                {filtered
                  ? `${visible.length} of ${products.length} shown`
                  : `${total} ${total === 1 ? "item" : "items"} found`}
              </p>
            </div>
            <SortDropdown />
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-shop-line bg-white px-6 py-20 text-center">
              <p className="text-[17px] font-semibold text-shop-ink">
                {filtered
                  ? "No products match these filters"
                  : query
                    ? `No matches for “${query}”`
                    : "What are you looking for?"}
              </p>
              <p className="mx-auto mt-2 max-w-md text-[13px] text-shop-muted">
                {filtered
                  ? "Try widening the price range or clearing a filter."
                  : query
                    ? "Check the spelling, or try a shorter, more general term."
                    : "Use the search bar above to find items or brands."}
              </p>
              <Link href="/" className="btn-shop mt-6 px-6 py-2.5 text-[13px]">
                Continue shopping
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visible.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                basePath="/search"
                page={page}
                totalPages={total_pages}
                params={{ q: query, sort }}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
