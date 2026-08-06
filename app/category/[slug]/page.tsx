import Link from "next/link";
import { getProductsSafe } from "@/lib/woocommerce";
import { sortProducts } from "@/lib/sort-products";
import ProductCard from "@/components/ProductCard";
import SortDropdown from "@/components/SortDropdown";
import FilterSidebar from "@/components/FilterSidebar";
import Pagination from "@/components/Pagination";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string; min_price?: string; max_price?: string; rating?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam, sort } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { products, total, total_pages } = await getProductsSafe({
    category: slug,
    page,
    per_page: 24,
  });

  const sorted = sortProducts(products, sort);
  const title = slug.replace(/-/g, " ");

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-24 pt-4 md:px-8 lg:pb-10">
      {/* Breadcrumbs */}
      <nav className="mb-4 flex items-center gap-2 text-[13px] text-[#555]">
        <Link href="/" className="hover:text-black hover:underline">
          Home
        </Link>
        <span className="text-[#999]">›</span>
        <span className="capitalize text-black">{title}</span>
      </nav>

      <div className="flex items-start gap-8">
        {/* Filters */}
        <div className="hidden w-56 shrink-0 lg:block">
          <FilterSidebar />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-bfl-line pb-4">
            <div>
              <h1 className="text-[26px] font-normal capitalize text-black">{title}</h1>
              <p className="mt-0.5 text-[13px] text-bfl-grey">
                {total} {total === 1 ? "item" : "items"}
              </p>
            </div>
            <SortDropdown />
          </div>

          {/* Mobile filters */}
          <details className="group mb-4 lg:hidden">
            <summary className="flex cursor-pointer items-center justify-between border border-bfl-line bg-white px-4 py-2.5 text-[13px] font-bold">
              <span>Filter &amp; sort</span>
              <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-3">
              <FilterSidebar />
            </div>
          </details>

          {sorted.length === 0 ? (
            <div className="border border-bfl-line bg-bfl-surface px-6 py-16 text-center">
              <p className="text-[16px] font-bold text-black">Nothing in this department yet</p>
              <p className="mt-1.5 text-[13px] text-bfl-grey">
                New stock lands every week — try another department in the meantime.
              </p>
              <Link href="/" className="btn-bfl mt-5 inline-block px-6 py-2.5 text-[13px]">
                Continue shopping
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {sorted.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                basePath={`/category/${slug}`}
                page={page}
                totalPages={total_pages}
                params={{ sort }}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
