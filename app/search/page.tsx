import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProductsSafe, type Product } from "@/lib/woocommerce";
import { sortProducts, filterProducts, toProductQuery } from "@/lib/sort-products";
import FilteredProductGrid from "@/components/FilteredProductGrid";
import ProductCard from "@/components/ProductCard";
import { PRODUCT_GRID, forGrid } from "@/lib/product-grid";

/**
 * Search results are not content, and Google should not hold any.
 *
 * Every query, sort order and filter combination is another URL showing the
 * same products in a different order. Left indexable they crowd out the pages
 * that should rank — the category and product pages the results are drawn from
 * — and burn the crawl budget a young domain barely has. `follow` stays on, so
 * a crawler that lands here still walks through to the products.
 */
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

type Search = {
  q?: string;
  page?: string;
  sort?: string;
  /** Department the query is limited to, from the scope select in the masthead. */
  category?: string;
  min_price?: string;
  max_price?: string;
  stock?: string;
  sale?: string;
  brand?: string;
};

/** The sort orders the homepage channels link to without a search term. */
const BROWSE_TITLES: Record<string, string> = {
  newest: "New in",
  popular: "Best sellers",
  rating: "Top rated",
  price_asc: "Lowest prices",
};

/** The sort chips, in the order a shopper reaches for them. */
const SORTS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "Best match" },
  { value: "price_asc", label: "Lowest price" },
  { value: "popular", label: "Best sellers" },
  { value: "newest", label: "Newest" },
];

/** "Under" price chip. One figure, chosen to sit around the middle of the catalogue. */
const UNDER = 50_000;

/** Fewer results than this and recommendations are shown under them. */
const FEW = 8;

/**
 * Search, made simple.
 *
 * It was a filter sidebar beside the results (a collapsed panel above them on
 * a phone) and, when nothing matched, a dead end that said "What are you
 * looking for?". Now it is: what you searched and how many there are, one row
 * of filter chips and one row of sort chips — every one a plain link — then
 * the products. When there is nothing, or very little, the page recommends:
 * the shop's departments as chips and a grid of its best sellers, so a shopper
 * always has somewhere to go next.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const search = await searchParams;
  const { q = "", page: pageParam, sort, category } = search;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = q.trim();
  const scope = category?.trim() || undefined;

  /* A recognised sort is enough on its own: the homepage channels link here
     with `?sort=newest` and no word, and that lists the whole catalogue in
     that order. */
  const browseTitle = BROWSE_TITLES[sort ?? ""];
  /* All three asked for at once. The best sellers used to wait for the
     results, adding a second WordPress round trip to every thin search; they
     are the same cached list the rest of the shop uses, so fetching them
     alongside costs nothing when they are not shown. The term is lower-cased
     so "Shoes" and "shoes" share one cached answer. */
  const [{ products, total, total_pages }, categories, bestSellers] = await Promise.all([
    query || browseTitle
      ? getProductsSafe(
          {
            ...(query ? { search: query.toLowerCase() } : {}),
            page,
            per_page: 24,
            ...(scope ? { category: scope } : {}),
            ...toProductQuery(search),
          },
          { retryEmpty: false }
        )
      : Promise.resolve({ products: [] as Product[], total: 0, total_pages: 0 }),
    // A convenience on a page that works without it: an outage costs the
    // shopper the category chips, not the search.
    getCategories().catch(() => []),
    getProductsSafe({ per_page: 12, sort: "popular", in_stock: true }),
  ]);

  const visible = sortProducts(filterProducts(products, search), sort);
  const filtering = Boolean(search.sale || search.stock || search.max_price || search.min_price || search.brand);

  /* Recommendations: best sellers in stock, minus anything already shown. */
  const recommend =
    visible.length < FEW
      ? bestSellers.products.filter((product) => !visible.some((shown) => shown.id === product.id)).slice(0, 12)
      : [];

  /* Category chips: the departments the results actually come from, most
     common first; with no results, the shop's busiest departments. */
  const resultCategories = uniqueByName(countCategories(visible)).slice(0, 6);
  const popularCategories = uniqueByName(
    categories
      .filter((item) => (item.count ?? 0) > 0)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  ).slice(0, 10);

  /** The current URL with some parameters changed; `undefined` removes one. */
  const href = (changes: Partial<Record<keyof Search, string | undefined>>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...search, page: undefined, ...changes })) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  };

  const heading = query ? `Results for “${query}”` : (browseTitle ?? "Search the shop");
  const count = filtering ? visible.length : total;

  return (
    <main className="srch mx-auto w-full max-w-[var(--shell)] px-0 pb-24 pt-3 md:px-8 lg:pb-10">
      <div className="phone-gutter">
        <h1 className="srch-title">{heading}</h1>
        {(query || browseTitle) && (
          <p className="srch-count">
            {count} {count === 1 ? "item" : "items"}
            {scope ? " in this department" : ""}
          </p>
        )}

        {(query || browseTitle) && (
          <>
            {/* ---- Filters: one tap each, tap again to undo ---- */}
            <div className="srch-chips no-scrollbar" aria-label="Filter results">
              <Chip href={href({ sale: search.sale === "1" ? undefined : "1" })} on={search.sale === "1"}>
                On sale
              </Chip>
              <Chip
                href={href({ max_price: search.max_price ? undefined : String(UNDER) })}
                on={Boolean(search.max_price)}
              >
                Under UGX 50,000
              </Chip>
              <Chip href={href({ stock: search.stock === "1" ? undefined : "1" })} on={search.stock === "1"}>
                In stock
              </Chip>
              {resultCategories.map((item) => (
                <Chip
                  key={item.slug}
                  href={href({ brand: search.brand === item.slug ? undefined : item.slug })}
                  on={search.brand === item.slug}
                >
                  {item.name}
                </Chip>
              ))}
              {filtering && (
                <Link
                  href={href({ sale: undefined, stock: undefined, max_price: undefined, min_price: undefined, brand: undefined })}
                  className="srch-clear"
                >
                  Clear filters
                </Link>
              )}
            </div>

            {/* ---- Sort ---- */}
            <div className="srch-sort no-scrollbar" aria-label="Sort results">
              <span className="srch-sort-label">Sort:</span>
              {SORTS.map((option) => (
                <Link
                  key={option.label}
                  href={href({ sort: option.value })}
                  className={`srch-sort-opt ${sort === option.value || (!sort && !option.value) ? "srch-sort-on" : ""}`}
                  aria-current={sort === option.value || (!sort && !option.value) ? "true" : undefined}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="phone-gutter">
          <div className="srch-empty">
            <p className="srch-empty-title">
              {filtering
                ? "Nothing matches these filters"
                : query
                  ? `We couldn't find “${query}”`
                  : "What are you looking for today?"}
            </p>
            <p className="srch-empty-copy">
              {filtering
                ? "Clear a filter to see more."
                : query
                  ? "Check the spelling, use one word (for example “shoes”), or pick a department below."
                  : "Type in the search bar above, or start from a department."}
            </p>
            {!filtering && popularCategories.length > 0 && (
              <div className="srch-popular">
                {popularCategories.map((item) => (
                  <Link key={item.slug} href={`/category/${item.slug}`} className="srch-chip">
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <FilteredProductGrid
          initialProducts={visible.map(forGrid)}
          totalPages={total_pages}
          startPage={page}
          query={{
            q: query,
            category: search.brand || scope,
            sort,
            onSale: search.sale === "1",
            inStock: search.stock === "1",
            minPrice: search.min_price,
            maxPrice: search.max_price,
          }}
          filters={search}
          sort={sort}
          gridClassName={PRODUCT_GRID}
          doneLabel={query ? "That is every match for this search." : "That is everything for now."}
        />
      )}

      {recommend.length > 0 && (
        <section className="mt-8" aria-labelledby="srch-rec">
          <h2 id="srch-rec" className="phone-gutter srch-rec-title">
            {visible.length === 0 ? "Recommended for you" : "You may also like"}
          </h2>
          <ul className={PRODUCT_GRID}>
            {recommend.map((product) => (
              <li key={product.id}>
                <ProductCard product={forGrid(product)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`srch-chip ${on ? "srch-chip-on" : ""}`} aria-pressed={on} scroll={false}>
      {on && <span aria-hidden>✓ </span>}
      {children}
    </Link>
  );
}

/**
 * One chip per label: Men and Women each have a "Shoes", and two chips both
 * reading "Shoes" look like a bug. The first (busiest) of each name is kept.
 */
function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The categories of a set of products, most common first. */
function countCategories(products: Product[]): { slug: string; name: string }[] {
  const counts = new Map<string, { slug: string; name: string; n: number }>();
  for (const product of products) {
    for (const item of product.categories) {
      const entry = counts.get(item.slug) ?? { slug: item.slug, name: item.name, n: 0 };
      entry.n += 1;
      counts.set(item.slug, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n);
}
