import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProductsSafe } from "@/lib/woocommerce";
import { getSiteSettings } from "@/lib/site-settings";
import { absolute, breadcrumbJsonLd, collectionJsonLd, faqJsonLd } from "@/lib/seo";
import CategoryIntro, { categoryFaqs } from "@/components/CategoryIntro";
import { sortProducts, filterProducts, brandFacets, toProductQuery } from "@/lib/sort-products";
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
  const [categories, settings] = await Promise.all([
    getCategories().catch(() => []),
    getSiteSettings(),
  ]);
  const category = categories.find((entry) => entry.slug === slug);

  const name = category?.name ?? slug.replace(/-/g, " ");
  const count = category?.count ?? 0;

  /**
   * "Bags in Uganda — Buy Online at KandiUg".
   *
   * The bare "<name> in Uganda" this used to be is the right head term, but it
   * left the tag with nothing a shopper could act on. "Buy … online" is the
   * intent half of the query — the searches worth having are transactional
   * ("bags in uganda", "buy bags online uganda"), not encyclopaedic.
   */
  const title = `${name} in Uganda`;

  /**
   * The description now leads with prices.
   *
   * A category page competes for "<thing> in uganda", and what a shopper wants
   * from that result is the range before they click. `${count} items` on its
   * own said nothing about whether the shop is worth opening.
   *
   * The returns figure comes from wp-admin rather than the "14-day returns"
   * that used to be typed here — the same fix applied across the storefront, so
   * this page cannot promise a window the checkout does not honour.
   */
  const description = `Buy ${name.toLowerCase()} online in Uganda${
    count > 0 ? ` — ${count} item${count === 1 ? "" : "s"} in stock` : ""
  }. Low prices, fast delivery countrywide, pay on delivery and ${
    settings.commerce.returns_days
  }-day returns.`;

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

  // Sort and the price/stock filters are applied by WordPress across the whole
  // category, not just the 24 rows this page returns — otherwise paging through
  // a sorted category reshuffles at every page boundary.
  const [{ products, total, total_pages }, categories, settings] = await Promise.all([
    getProductsSafe({
      category: slug,
      page,
      per_page: 24,
      ...toProductQuery(search),
    }),
    // For the department's real name. `generateMetadata` already resolves it
    // and Next dedupes the fetch within a render, so this costs nothing.
    getCategories().catch(() => []),
    getSiteSettings(),
  ]);

  // Facets are counted before filtering so the counts stay stable as the
  // shopper narrows down; the grid itself shows the filtered, sorted page.
  const brands = brandFacets(products);
  const visible = sortProducts(filterProducts(products, search), sort);
  /**
   * The department's name as WooCommerce holds it, not as the URL spells it.
   *
   * This was `slug.replace(/-/g, " ")`, so the page's own `<h1>` read "mens
   * shoes" while the `<title>` this file also generates read "Men's Shoes in
   * Uganda". The heading is the strongest on-page signal there is about what a
   * page is for, and it was the one place on the page still guessing at the
   * answer from a URL fragment. The slug stays as the fallback for a category
   * that has been deleted between the fetch and the render.
   */
  const title = categories.find((entry) => entry.slug === slug)?.name
    ?? slug.replace(/-/g, " ");
  const filtered = visible.length !== products.length;

  /**
   * The prose block is written for one page only: the unfiltered first page.
   *
   * The canonical drops every query string, so page 2 and every facet
   * combination already point back here — repeating the same four paragraphs
   * under each of them would be the same text on a dozen URLs, which is worth
   * nothing to a crawler and is a wasted screen for a shopper who has scrolled
   * that far twice.
   */
  const showIntro = page === 1 && !filtered && visible.length > 0;
  const faqs = showIntro
    ? categoryFaqs({ name: title, total, products: visible, settings })
    : [];

  return (
    <main className="w-full px-0 pb-24 pt-4 md:px-8 lg:pb-12">
      {/* The same trail as the visible breadcrumbs below, in the form Google
          reads. It is what turns "kandiug.com › category › men" in a result
          into "Home › Men", and it tells a crawler where this page sits in the
          shop rather than leaving it to guess from the URL. */}
      {/* The ItemList alongside it names the products on the page, which is
          what gets them discovered as products rather than as words in a long
          document. `collectionJsonLd` existed in lib/seo.ts and was never
          called from anywhere — the markup was written and then not wired up. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: title, path: `/category/${slug}` },
            ]),
            collectionJsonLd(title, `/category/${slug}`, visible),
            // The same questions the page renders below the grid, never a
            // second set — Google drops FAQ data it cannot see on the page.
            ...(faqs.length > 0 ? [faqJsonLd(faqs)] : []),
          ]),
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
              <h1 className="section-title text-[20px] capitalize text-shop-ink md:text-[24px]">
                {title}
              </h1>
              <p className="section-sub mt-1 text-[14px]">
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
              {/* 8px between columns, 16px between rows, opening to 12/24 from
                  sm — the same figures as every other product grid on the site,
                  and they are meant to stay the same.

                  This was 1px across and 4px down. Both the tiles and the page
                  are white, so those gaps drew nothing: each row arrived as one
                  wide band of photographs rather than four products. Rows get
                  more air than columns because a grid is scanned downwards, so
                  the join that was actually failing was a tile's last line of
                  text against the next tile's picture. */}
              <div className="grid grid-cols-2 gap-x-1.5 gap-y-3 sm:grid-cols-3 md:gap-x-3 md:gap-y-5 lg:grid-cols-5 xl:grid-cols-6">
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

              {/* Below the grid deliberately. A shopper who arrived knowing what
                  they want should meet products first; the text is for the one
                  who scrolled to the end without buying, and for Google. */}
              {showIntro && (
                <CategoryIntro
                  name={title}
                  total={total}
                  products={visible}
                  settings={settings}
                  faqs={faqs}
                />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
