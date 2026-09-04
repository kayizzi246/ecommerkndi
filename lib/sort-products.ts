import type { Product, ProductQuery } from "@/lib/woocommerce";
import { discountPercent } from "@/lib/currency";

/**
 * Turns the URL's sort and filter parameters into a WordPress query.
 *
 * This is the half of listing behaviour that has to happen on the server. The
 * pages used to do all of it in the browser, against whichever 24 rows they had
 * been handed — so "price: low to high" ordered one page at a time, "in stock
 * only" emptied pages while the pagination still promised more, and the result
 * count never matched what was on screen.
 *
 * Everything WooCommerce can express goes through here. What it cannot express
 * — the discount ordering, and the brand facet, which is counted from the
 * products themselves — stays in {@link sortProducts} and
 * {@link filterProducts} below, applied to the page afterwards. Those two are
 * now refinements of a correctly sorted, correctly filtered result set rather
 * than a substitute for one.
 */
export function toProductQuery(search: ProductFilters & { sort?: string }): Partial<ProductQuery> {
  const query: Partial<ProductQuery> = {};

  // `discount` is missing from this map deliberately: WooCommerce cannot order
  // by a comparison between two meta values, so it stays page-local.
  const sorts: Record<string, ProductQuery["sort"]> = {
    price_asc: "price_asc",
    price_desc: "price_desc",
    newest: "newest",
    popular: "popular",
    rating: "rating",
  };
  if (search.sort && sorts[search.sort]) query.sort = sorts[search.sort];

  if (search.stock === "1") query.in_stock = true;

  const min = Number(search.min_price);
  const max = Number(search.max_price);
  if (search.min_price && Number.isFinite(min) && min > 0) query.min_price = min;
  if (search.max_price && Number.isFinite(max) && max > 0) query.max_price = max;

  /* ---- The refinement goes to WordPress, where the pagination is ----
   *
   * `brand` is a category slug, and it used to be page-local: the products
   * were fetched for the department, and `filterProducts` then dropped the ones
   * without that category from whatever twenty-four rows had arrived. On a
   * department of four hundred that is a filter that reports four results
   * because four of page one matched, and then dribbles more in as the shopper
   * scrolls — which reads as a filter that does not work, because for any
   * purpose a shopper has, it does not.
   *
   * Sent as `category` it is the server's job, so the count, the ordering and
   * the paging are all over the real result set. It deliberately REPLACES the
   * department in the query rather than joining it: the WooCommerce REST
   * `category` parameter is an OR across ids, so there is no way to ask it for
   * two at once, and narrowing to the child is the correct answer anyway
   * because the facet only ever offers descendants of the department the
   * shopper is in. `FilterSidebar` enforces that, and the two have to stay in
   * step — an option from outside the branch would silently move the shopper
   * out of the department they are browsing.
   *
   * `filterProducts` still applies the same check client-side. It is redundant
   * for anything this query returns and it is the guard for anything that
   * arrives another way — a cached page from before the refinement, or a feed
   * whose query prop was not updated with it. */
  if (search.brand) query.category = search.brand;

  return query;
}

export type ProductFilters = {
  min_price?: string;
  max_price?: string;
  /** "1" restricts to products currently in stock. */
  stock?: string;
  /** "1" restricts to discounted products. */
  sale?: string;
  /**
   * Whole percent. Restricts to products reduced by at least this much.
   *
   * `sale` answers "is it reduced at all", which is not the same question as
   * "show me half price" — and a "50% off" entry point that quietly includes
   * things reduced by 5% is the kind of thing a shopper checks once and never
   * trusts again.
   */
  min_discount?: string;
  /** Category slug from the brand facet. */
  brand?: string;
};

/**
 * Applies the filter query parameters to a page of products.
 *
 * Like {@link sortProducts}, this refines the page the API returned rather
 * than the whole catalogue — the WordPress endpoint only filters by category,
 * search, on_sale and featured, so price, stock and brand are resolved here.
 */
export function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  const min = Number(filters.min_price);
  const max = Number(filters.max_price);

  const minDiscount = Number(filters.min_discount);

  return products.filter((product) => {
    if (Number.isFinite(min) && filters.min_price && product.price < min) return false;
    if (Number.isFinite(max) && filters.max_price && product.price > max) return false;
    if (filters.stock === "1" && product.stock_status !== "instock") return false;
    if (filters.sale === "1" && !product.on_sale) return false;
    if (
      Number.isFinite(minDiscount) &&
      filters.min_discount &&
      // The same `discountPercent` the tiles print, so a product shown as
      // "−50%" is one this filter agrees is 50% off. Computing the reduction a
      // second way here is how a "50% off" page ends up listing a tile badged
      // 49%.
      discountPercent(product.regular_price, product.price) < minDiscount
    ) {
      return false;
    }
    if (filters.brand && !product.categories.some((c) => c.slug === filters.brand)) {
      return false;
    }
    return true;
  });
}

/** The brand facet, counted from the products actually on the page. */
export function brandFacets(products: Product[]): { slug: string; name: string; count: number }[] {
  const counts = new Map<string, { slug: string; name: string; count: number }>();

  for (const product of products) {
    for (const category of product.categories) {
      const existing = counts.get(category.slug);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(category.slug, { slug: category.slug, name: category.name, count: 1 });
      }
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Applies the `sort` query parameter to a page of products. The WordPress API
 * only orders by date, so the listing pages refine the current page locally —
 * shared here so every listing sorts identically.
 */
export function sortProducts(products: Product[], sort?: string): Product[] {
  const sorted = [...products];

  switch (sort) {
    case "price_asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price_desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "discount":
      return sorted.sort(
        (a, b) =>
          discountPercent(b.regular_price, b.price) - discountPercent(a.regular_price, a.price)
      );
    case "newest":
      return sorted.sort((a, b) => {
        if (!a.date_created) return 1;
        if (!b.date_created) return -1;
        return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
      });
    /**
     * Most bought first.
     *
     * This case was missing while `?sort=popular` was already being linked
     * from the site — the "View all" beside Trending now and Best sellers both
     * point at it — so those links fell through to `default` and returned the
     * page in whatever order WooCommerce sent it. The label said popular and
     * the order was arbitrary, which is worse than offering no such sort.
     */
    case "popular":
      return sorted.sort((a, b) => b.total_sales - a.total_sales);
    default:
      return sorted;
  }
}
