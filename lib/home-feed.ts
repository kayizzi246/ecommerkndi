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

/**
 * A page-wide ledger of which products have already been shown.
 *
 * ## What was wrong
 *
 * This module's own docstring promised "no product appears twice", and the
 * three discount rails did honour it — they are slices of one sorted array. But
 * that was the only place the rule existed, and it covered three rails out of
 * eight. Everything else drew, unfiltered, from the same two fetches:
 *
 *   • `latest` (one page of the catalogue) fed **trending**, **new arrivals**,
 *     **best sellers**, the **Daily Deals top-up** and the endless grid.
 *   • `onSale` fed the three discount rails, and every on-sale product is also
 *     in `latest`.
 *
 * So "Trending now" was the first twelve of the catalogue; "New arrivals" was
 * the same twelve re-sorted by a date they were already roughly in order by;
 * "Best sellers" was those twelve again minus the ones nobody had bought. On a
 * catalogue of this size a shopper scrolling the homepage met the same handful
 * of products in section after section, which is exactly what it looked like.
 *
 * ## The fix
 *
 * Rails are now filled in the order they appear on the page, each taking only
 * products no rail above it has taken. A rail that cannot reach its minimum
 * from what is left renders nothing at all rather than padding itself with
 * repeats — a shorter homepage of distinct sections is worth more than a long
 * one that shows the same six things eight times, and the sections come back on
 * their own as the catalogue grows.
 */
class Ledger {
  private readonly seen = new Set<number>();

  /**
   * Takes up to `count` unseen products from `pool`.
   *
   * All-or-nothing against `minimum`: a rail that cannot be filled properly
   * releases its claim, so the products stay available to the rails below it
   * instead of being stranded inside a section that never renders.
   */
  claim(pool: Product[], count: number, minimum = MIN_RAIL): Product[] {
    const picked: Product[] = [];

    for (const product of pool) {
      if (picked.length >= count) break;
      if (this.seen.has(product.id)) continue;
      picked.push(product);
    }

    if (picked.length < minimum) return [];

    for (const product of picked) this.seen.add(product.id);
    return picked;
  }

  /** Everything in `pool` that no rail has taken. */
  unclaimed(pool: Product[]): Product[] {
    return pool.filter((product) => !this.seen.has(product.id));
  }
}

/** How recent a listing must be to count as new, on the product page badge. */
const DEPARTMENT_MINIMUM = 2;

export type DepartmentRailData = {
  id: string;
  title: string;
  subtitle: string;
  chip: string;
  /** Tailwind classes for the web chip. The app maps the id to its palette. */
  tone: string;
  /** Tailwind classes tinting the whole band on the web. Ignored by the app. */
  band: string;
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
    tone: "text-pop-blue",
    /**
     * The band tint, as a gradient that fades to white before the products
     * reach it.
     *
     * The colour lives in the heading strip and dies out under the tiles: a
     * saturated slab running the full height of a rail would put a cast behind
     * every product photograph in it, which is the one thing a shop cannot
     * afford to do to its own stock.
     */
    band: "from-pop-blue-soft",
  },
  {
    id: "dept-women",
    match: "women",
    title: "For women",
    subtitle: "The pieces moving fastest right now",
    chip: "For her",
    tone: "text-pop-violet",
    band: "from-pop-violet-soft",
  },
  {
    id: "dept-kids",
    match: "kids",
    title: "For kids",
    subtitle: "Hard-wearing, and priced to be replaced",
    chip: "Little ones",
    tone: "text-pop-green",
    band: "from-pop-green-soft",
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
    /**
     * 48, not 24.
     *
     * Trending, New arrivals and Best sellers are all sorted out of this one
     * page, and now that they may not share products between them they need
     * roughly 36 distinct rows before the third rail has anything left to show.
     * At 24 the dedup would have silently emptied Best sellers on any catalogue
     * — the rule would have looked like a bug.
     */
    getProductsSafe({ per_page: 48 }),
    // Only for the seller band's store count. Returns [] on an older plugin, so
    // the band simply drops the figure rather than the page failing.
    getStores(),
    // The department tree. Next dedupes identical fetches within a render, so
    // the layout asking for this too costs one request, not two.
    getCategories().then(buildCategoryTree),
  ]);

  const departmentPools = await Promise.all(
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

  /**
   * Rails are filled in the order they appear on the page, not the order this
   * object lists them in — see `app/page.tsx`:
   *
   *   trending → Daily Deals → promotions → new arrivals → best sellers →
   *   department rails → Super Deals → the endless grid
   *
   * Order is the whole mechanism. Whatever is claimed first gets the strongest
   * stock, so the sequence here is a merchandising decision and has to track
   * the page. If a section moves in the JSX, it moves here too.
   */
  const ledger = new Ledger();

  const trending = ledger.claim(trendingPool, 12);

  /**
   * Daily Deals is filled before Promotions because it sits above it, and it
   * is titled "Lowest prices today" — so it should genuinely hold the deepest
   * cuts rather than the leftovers of two rails that took theirs first. It used
   * to get `bySaving.slice(24)`, the shallowest discounts in the pool, under a
   * badge announcing the best.
   *
   * Topped up here rather than by the component. `DailyDeals` accepts a
   * `fallback` list and pads itself from it — and the page was handing it the
   * whole catalogue, which put products from every other rail straight back
   * into it. The top-up now comes from the ledger's unclaimed remainder, so it
   * can only ever add something new.
   */
  const dailyDeals = ledger.claim(bySaving, 16, 1);
  if (dailyDeals.length > 0 && dailyDeals.length < 6) {
    const cheapest = ledger
      .unclaimed(latest.products)
      .sort((a, b) => a.price - b.price);
    dailyDeals.push(...ledger.claim(cheapest, 6 - dailyDeals.length, 1));
  }

  const promoProducts = ledger.claim(bySaving, 12);
  const newArrivalsRail = ledger.claim(newArrivals, 12);
  const bestSellersRail = ledger.claim(bestSellers, 12);

  const departmentRails = departmentPools.map((department) => ({
    ...department,
    products: ledger.claim(department.products, 12, DEPARTMENT_MINIMUM),
  }));

  // Super Deals sits near the foot of the page, so it claims last of the rails.
  const deals = ledger.claim(bySaving, 12);

  return {
    settings,
    departments,
    storeCount: stores.length,
    trending,
    promoProducts,
    deals,
    dailyDeals,
    newArrivals: newArrivalsRail,
    bestSellers: bestSellersRail,
    departmentRails,
    /**
     * The endless grid is deliberately *not* deduplicated.
     *
     * It is the catalogue itself — "Picked for you" is where a shopper goes to
     * browse everything, and a grid with holes punched in it wherever a rail
     * happened to use a product would be a worse browse, not a better one. The
     * repetition the ledger exists to stop is the same product appearing in rail
     * after rail on the way down; meeting it once more in the full catalogue at
     * the bottom is what a catalogue is for.
     */
    latest: latest.products,
    latestTotalPages: latest.total_pages,
    departmentMinimum: DEPARTMENT_MINIMUM,
  };
}
