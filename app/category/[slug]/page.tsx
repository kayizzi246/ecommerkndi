import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProductsSafe } from "@/lib/woocommerce";
import { absolute, breadcrumbJsonLd } from "@/lib/seo";
import { sortProducts, filterProducts, brandFacets } from "@/lib/sort-products";
import ProductCard from "@/components/ProductCard";
import SortDropdown from "@/components/SortDropdown";
import FilterSidebar from "@/components/FilterSidebar";
import Pagination from "@/components/Pagination";

type Search = {
  page?: string;
  sort?: string;
  min_price?: string;
  max_price?: string;
  stock?: string;
  sale?: string;
  brand?: string;
};

/**
 * Category metadata.
 *
 * Category pages are what rank for the searches that actually bring a new shop
 * traffic — "men's shoes Kampala", "buy hoodies Uganda" — because they target a
 * category term rather than one product name. A shared site-wide title gave
 * them nothing to rank on.
 *
 * The canonical deliberately drops the filter and page query strings: every
 * combination of facets would otherwise be a separate near-identical URL
 * competing with the clean one.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories().catch(() => []);
  const category = categories.find((entry) => entry.slug === slug);

  const name = category?.name ?? slug.replace(/-/g, " ");
  const count = category?.count ?? 0;

  const title = `${name} in Uganda`;
  const description = `Shop ${name.toLowerCase()} on KandiUg${
    count > 0 ? ` — ${count} item${count === 1 ? "" : "s"}` : ""
  }. Low prices, fast delivery across Uganda, pay on delivery and 14-day returns.`;

  return {
    title,
    description,
    alternates: { canonical: absolute(`/category/${slug}`) },
    openGraph: {
      title,
      description,
      url: absolute(`/category/${slug}`),
      images: category?.image ? [{ url: category.image, alt: name }] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const { page: pageParam, sort } = search;
  const page = Math.max(1, Number(pageParam) || 1);

  const { products, total, total_pages } = await getProductsSafe({
    category: slug,
    page,
    per_page: 24,
  });

  // Facets are counted before filtering so the counts stay stable as the
  // shopper narrows down; the grid itself shows the filtered, sorted page.
  const brands = brandFacets(products);
  const visible = sortProducts(filterProducts(products, search), sort);
  const title = slug.replace(/-/g, " ");
  const filtered = visible.length !== products.length;

  return (
    <main className="w-full px-0 pb-24 pt-4 md:px-8 lg:pb-12">
      {/* The same trail as the visible breadcrumbs below, in the form Google
          reads. It is what turns "kandiug.com › category › men" in a result
          into "Home › Men", and it tells a crawler where this page sits in the
          shop rather than leaving it to guess from the URL. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: title, path: `/category/${slug}` },
            ])
          ),
        }}
      />

      {/* Breadcrumbs */}
      <nav className="mb-5 flex items-center gap-2 px-3 text-[13px] text-shop-muted md:px-0">
        <Link href="/" className="hover:text-shop-ink">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="capitalize text-shop-ink">{title}</span>
      </nav>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Filter rail */}
        <div className="order-first w-full flex-none px-3 md:w-56 md:px-0 lg:w-64">
          <div className="hidden md:sticky md:top-32 md:block">
            <FilterSidebar brands={brands} />
          </div>

          {/* Mobile: filters collapse into a disclosure. */}
          <details className="group rounded-lg border border-shop-line bg-white md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold text-shop-ink">
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
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-shop-line px-3 pb-4 md:px-0">
            <div>
              <h1 className="section-title text-[20px] capitalize text-shop-ink md:text-[19px]">
                {title}
              </h1>
              <p className="mt-1 text-[14px] text-shop-muted">
                {filtered
                  ? `${visible.length} of ${products.length} shown`
                  : `${total} ${total === 1 ? "item" : "items"}`}
              </p>
            </div>
            <SortDropdown />
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-shop-line bg-white px-6 py-20 text-center">
              <p className="text-[18px] font-semibold text-shop-ink">
                {filtered || products.length > 0
                  ? "No products match these filters"
                  : "Nothing in this department yet"}
              </p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-shop-muted">
                {filtered || products.length > 0
                  ? "Try widening the price range or clearing a filter."
                  : "New stock lands every week — try another department in the meantime."}
              </p>
              <Link href="/" className="btn-shop mt-6 px-6 py-2.5 text-[14px]">
                Continue shopping
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-px gap-y-2 sm:gap-y-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {visible.map((product) => (
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
