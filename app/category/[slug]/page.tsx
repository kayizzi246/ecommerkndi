import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
    /**
     * A real department with nothing in it yet is asked not to be indexed.
     *
     * Search Console was reporting ten SOFT 404s — pages answering 200 with
     * nothing on them — and an empty category is the shape of that: a heading,
     * a filter sidebar, and a grid with no products. Google reads the 200 and
     * the emptiness, decides the page is a not-found in disguise, and the shop
     * loses a little credibility for every one it finds.
     *
     * `follow: true` alongside it: there is nothing here to index, but the
     * links to the rest of the shop are still worth walking.
     *
     * A category that does not exist AT ALL is handled harder, in the page
     * itself — see the `notFound()` below. The difference is deliberate: an
     * empty department is a shop still filling up and will have stock next
     * week, where an unknown slug is a URL that was never real.
     */
    robots: category && count === 0 ? { index: false, follow: true } : undefined,
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

  /**
   * ---- Two ways this page used to answer 200 when it should not have ----
   *
   * Both were showing up in Search Console as SOFT 404s: a page that returns
   * "here it is" and then shows nothing. Google counts those against the whole
   * site, because a shop that says yes to every URL is a shop whose yes means
   * nothing.
   *
   * 1. AN UNKNOWN SLUG. /category/anything-at-all rendered a full page —
   *    masthead, sidebar, an empty grid and a heading made by replacing the
   *    hyphens in the URL. Nothing in the file ever asked whether the category
   *    existed. Any stale link, any typo, any crawler guessing at URLs got a
   *    200 and a page about a department this shop has never had.
   *
   *    Guarded on `categories.length > 0` because that fetch is wrapped in a
   *    `.catch(() => [])`: if WordPress is unreachable the list is empty and
   *    EVERY slug would look unknown, which would take the whole category
   *    section of the shop down with a 404 rather than degrade. When the list
   *    is missing, the product count is the fallback test — a slug that
   *    returns products is a real category whatever the tree says.
   *
   * 2. A PAGE PAST THE END. /category/men?page=99 rendered an empty grid with
   *    pagination under it. There is no page 99, and saying so is what a 404
   *    is for. Page 1 is exempt: an empty FIRST page is a real department with
   *    no stock in it today, which is a different thing — it stays, and
   *    `generateMetadata` above marks it `noindex` instead.
   */
  /**
   * ---- Why there is no `loading.tsx` beside this file any more ----
   *
   * Because a `notFound()` under a Suspense boundary cannot set a status code,
   * and this page's whole reason for calling it is the status code.
   *
   * Next streams the response as soon as a Suspense fallback renders, and a
   * `loading.tsx` IS a Suspense fallback. Streaming means the headers have
   * already gone out by the time this component runs, so the 404 that
   * `notFound()` throws can only change the BODY. Next handles that as well as
   * it can — it injects `<meta name="robots" content="noindex">`, which does
   * keep the page out of the index — but the response is still a 200 with a
   * not-found page in it, and that is the literal definition of the SOFT 404
   * Search Console was reporting.
   *
   * The docs say it outright: "If you need a 404 status, for compliance or
   * analytics, ensure the resource exists before the response body is
   * streamed." Removing the boundary is how that is done here. The cost is the
   * skeleton this segment used to show while its data was in flight; it is
   * affordable now that the product reads are cached for five minutes rather
   * than fifteen seconds, and a correct status on every bad URL is worth more
   * to a shop that is trying to be indexed than a shimmer is.
   *
   * The same applies to `app/loading.tsx` and `app/products/[id]/loading.tsx`,
   * both removed in the same pass. If you add one back here, this page starts
   * answering 200 for categories that do not exist again.
   */
  const known = categories.some((entry) => entry.slug === slug);
  if (!known && (categories.length > 0 || products.length === 0)) notFound();
  if (page > 1 && products.length === 0) notFound();

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
    <main className="w-full px-3 pb-24 pt-4 md:px-8 lg:pb-12">
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
      <nav className="mb-5 flex items-center gap-2 text-[13px] text-shop-muted">
        <Link href="/" className="hover:text-shop-ink">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="capitalize text-shop-ink">{title}</span>
      </nav>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Filter rail */}
        <div className="order-first w-full flex-none md:w-56 lg:w-64">
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
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-shop-line pb-4">
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
              <div className="grid grid-cols-2 gap-x-1.5 gap-y-3 sm:grid-cols-3 md:gap-x-3 md:gap-y-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {/* ---- `sizes`, spelled out, because this page is full-bleed ----

                    The tile's default hint ends in a fixed `240px`, which is
                    the right answer on a page bounded at `--shell`: above
                    1720px the grid stops growing, so the tile is a known
                    number of pixels. This page overrides `--shell` to 100%
                    (see `StoreChrome`), so the tiles keep growing with the
                    window and that last entry would have the browser fetch a
                    240px file for a 306px box on a 2560px monitor — a soft
                    photograph on the one page that is nothing but photographs.

                    So each step is the arithmetic of the grid it describes:
                    the window, less the page's own padding, less the filter
                    rail and its gap, less the column gaps, over the number of
                    columns at that breakpoint. The two phone steps stay in
                    `vw` because the rail is stacked above the grid there
                    rather than beside it.

                    These have to move if the column ramp, the rail width or
                    the gaps do. That is the standing cost of a grid that
                    tracks the window instead of a fixed shell. */}
                {visible.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) calc((100vw - 356px) / 4), (max-width: 1279px) calc((100vw - 388px) / 4), (max-width: 1535px) calc((100vw - 412px) / 6), calc((100vw - 424px) / 7)"
                  />
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
