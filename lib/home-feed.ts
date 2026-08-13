import {
  getProductsSafe,
  getStores,
  getCategories,
  buildCategoryTree,
  type CategoryNode,
  type Product,
} from "@/lib/woocommerce";
import { findCategorySlug } from "@/lib/departments";
import { getSiteSettings, type SiteSettings } from "@/lib/site-settings";
import { discountPercent } from "@/lib/currency";

/**
 * The homepage, composed once and consumed twice.
 *
 * This module exists because of a specific failure mode. The website builds its
 * homepage rails in `app/page.tsx`; the Flutter app now needs the same rails
 * over JSON. If the app rebuilt them from its own queries — "on sale, sorted by
 * discount, first twelve" — the two would agree on the day they were written
 * and drift apart on the first change to either. Somebody would fix the ordering
 * on the web, nobody would remember the app, and the shop would be quietly
 * merchandising two different storefronts.
 *
 * So the composition lives here and both callers read the result:
 *
 *   app/page.tsx           → renders it as HTML
 *   app/api/app/home/route → serialises it as JSON for the app
 *
 * The rule this enforces: a merchandising decision is made once. Change the
 * cut-off for Best Sellers here and it changes in both places, in the same
 * deploy, without anyone needing to know the app exists.
 */

/** Below this a rail is a mistake rather than a row — hold it back. */
export const MIN_RAIL = 4;

/** How recent a listing must be to count as new, on the product page badge. */
const DEPARTMENT_MINIMUM = 2;

export type DepartmentRailData = {
  id: string;
  title: string;
  subtitle: string;
  chip: string;
  /** Tailwind classes for the web. The app maps the id to its own palette. */
  tone: string;
  /** Null when the shop has not created this department yet. */
  slug: string | null;
  products: Product[];
};

export type HomeFeed = {
  settings: SiteSettings;
  departments: CategoryNode[];
  storeCount: number;
  /** The shop's own picks, or the newest stock when nothing is flagged. */
  trending: Product[];
  /** Deepest discounts, the top slice. */
  promoProducts: Product[];
  /** The middle slice of the discount pool. */
  deals: Product[];
  /** Whatever discount stock is left after the two rails above. */
  dailyDeals: Product[];
  newArrivals: Product[];
  bestSellers: Product[];
  departmentRails: DepartmentRailData[];
  /** The general catalogue behind "Picked for you" / the endless grid. */
  latest: Product[];
  latestTotalPages: number;
  /** Minimum products a department rail needs before it renders. */
  departmentMinimum: number;
};

/**
 * Men, Women and Kids — the three departments almost every shopper arrives
 * already knowing they want.
 *
 * Slugs are resolved from the shop's own catalogue rather than assumed, because
 * a shop that has not created a Kids category yet must not get a rail that links
 * nowhere. `findCategorySlug` is the same matcher the header nav uses, so the
 * rail and the link above it can never disagree about which category a word
 * means.
 */
const DEPARTMENTS = [
  {
    id: "dept-men",
    match: "men",
    title: "For men",
    subtitle: "Shoes, shirts and everyday wear",
    chip: "For him",
    tone: "bg-pop-blue-soft text-pop-blue",
  },
  {
    id: "dept-women",
    match: "women",
    title: "For women",
    subtitle: "The pieces moving fastest right now",
    chip: "For her",
    tone: "bg-pop-violet-soft text-pop-violet",
  },
  {
    id: "dept-kids",
    match: "kids",
    title: "For kids",
    subtitle: "Hard-wearing, and priced to be replaced",
    chip: "Little ones",
    tone: "bg-pop-green-soft text-pop-green",
  },
] as const;

export async function buildHomeFeed(): Promise<HomeFeed> {
  const [settings, onSale, featured, latest, stores, departments] = await Promise.all([
    getSiteSettings(),
    // Enough on-sale stock for all three discount rails without any of them
    // repeating another's products: Promotions takes twelve, Super Deals the
    // next twelve, Daily Deals whatever is left (and tops itself up from the
    // general catalogue when that is thin, which it usually is).
    getProductsSafe({ on_sale: true, per_page: 36 }),
    getProductsSafe({ featured: true, per_page: 12 }),
    getProductsSafe({ per_page: 24 }),
    // Only for the seller band's store count. Returns [] on an older plugin, so
    // the band simply drops the figure rather than the page failing.
    getStores(),
    // The department tree. Next dedupes identical fetches within a render, so
    // the layout asking for this too costs one request, not two.
    getCategories().then(buildCategoryTree),
  ]);

  const departmentRails = await Promise.all(
    DEPARTMENTS.map(async (department) => {
      const slug = findCategorySlug(departments, department.match);
      if (!slug) {
        return { ...department, slug: null, products: [] as Product[] };
      }

      const { products } = await getProductsSafe({ category: slug, per_page: 12 });
      return { ...department, slug, products };
    })
  );

  /**
   * The three discount rails share one pool, cut so that no product appears in
   * two of them.
   *
   * Sorted by how much is genuinely off rather than by date, because that is
   * the question all three section titles raise, and the deepest cuts go to
   * Promotions — the highest of the three on the page, so it should carry the
   * strongest stock.
   */
  const bySaving = [...onSale.products].sort(
    (a, b) =>
      discountPercent(b.regular_price, b.price) -
      discountPercent(a.regular_price, a.price)
  );

  /**
   * New arrivals and Best sellers, sorted from the catalogue already in hand
   * rather than fetched again — a third and fourth WooCommerce round trip to
   * re-sort the same rows would cost the page its speed for nothing.
   *
   * Best sellers requires products that have genuinely sold: a "best sellers"
   * row of items nobody has bought is the kind of small lie that teaches
   * shoppers to distrust the rest of the page.
   */
  const newArrivals = [...latest.products]
    .filter((product) => product.date_created)
    .sort(
      (a, b) =>
        new Date(b.date_created!).getTime() - new Date(a.date_created!).getTime()
    )
    .slice(0, 12);

  const bestSellers = [...latest.products]
    .filter((product) => product.total_sales > 0)
    .sort((a, b) => b.total_sales - a.total_sales)
    .slice(0, 12);

  // Trending is the shop's own picks where any are flagged, newest otherwise.
  const trendingPool =
    featured.products.length > 0 ? featured.products : latest.products;

  return {
    settings,
    departments,
    storeCount: stores.length,
    trending: trendingPool.slice(0, 12),
    promoProducts: bySaving.slice(0, 12),
    deals: bySaving.slice(12, 24),
    dailyDeals: bySaving.slice(24),
    newArrivals,
    bestSellers,
    departmentRails,
    latest: latest.products,
    latestTotalPages: latest.total_pages,
    departmentMinimum: DEPARTMENT_MINIMUM,
  };
}
