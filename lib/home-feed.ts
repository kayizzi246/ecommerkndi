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

/**
 * How many tiles a department rail aims to carry.
 *
 * Twelve, which is what `DealCarousel` needs to fill its widest step and still
 * have something left to scroll to. A rail shorter than its visible column
 * count renders as a row with a hole on the end, which reads as products
 * failing to load rather than as a short department.
 */
const RAIL_TARGET = 12;

/**
 * How many products a department must have IN THE CATALOGUE before its rail is
 * allowed on the homepage at all.
 *
 * This is a different question from `DEPARTMENT_MINIMUM` above and the two are
 * easy to confuse, so: that one asks "are there enough products to fill a row",
 * and it is answered against the twelve this page fetched. This one asks "does
 * this department exist yet", and it is answered against the department's total
 * — the `total` WooCommerce returns with the page, not the length of the page.
 *
 * The distinction matters because a rail can look full and still be a lie. Four
 * men's products make a perfectly respectable row of four tiles; what they
 * cannot support is the promise the rail makes, which is "there is a men's
 * section here, go and browse it". A shopper who taps "For men" on the strength
 * of a full-looking row and lands on a category page with four items has been
 * told something untrue about the shop, and that is worse than not having been
 * told about the department at all.
 *
 * Twenty is the figure the shop asked for and it is a sensible one: it is about
 * two screens of a category page on a phone, which is the point at which a
 * department reads as somewhere to browse rather than as a shelf.
 *
 * Nothing is deleted by this — the departments are still in the menu, still in
 * /categories, and still have their own pages. They are only held back from the
 * homepage until they are worth arriving on. Raise or lower it here and both
 * the web homepage and the app's home feed change together.
 */
const DEPARTMENT_CATALOGUE_MINIMUM = 20;

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
  /**
   * "New in" — the newest listings from independent sellers, newest first.
   *
   * Distinct from `newArrivals`, which is the newest stock from any source. This
   * one is filtered on `product.seller`, so it is only ever marketplace
   * listings. Empty on a shop with no sellers, in which case the rail does not
   * render at all.
   */
  sellerArrivals: Product[];
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
  {
    /**
     * Shoes is here because it is what this shop actually sells.
     *
     * The other three are demographics — who the shopper is buying for. This
     * one is a product type, and mixing the two is normally how a homepage ends
     * up with eleven rails that all overlap. It earns the exception because
     * Shoes is the deepest category in the catalogue and the one people arrive
     * searching for by name, which is exactly the "I know what I want, take me
     * there" job the department rails exist to do.
     */
    id: "dept-shoes",
    match: "shoes",
    title: "Shoes",
    subtitle: "Trainers, boots and everyday pairs",
    chip: "Step out",
    tone: "text-pop-orange",
    band: "from-pop-orange-soft",
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
        return { ...department, slug: null, products: [] as Product[], total: 0 };
      }

      /* `total` is the whole department, not this page of it — WooCommerce
         sends the count back with every listing, so knowing whether a
         department has twenty products costs nothing beyond the twelve tiles
         the rail was already fetching. It is what
         `DEPARTMENT_CATALOGUE_MINIMUM` is measured against below. */
      const { products, total } = await getProductsSafe({ category: slug, per_page: 12 });
      return { ...department, slug, products, total };
    })
  );

  /**
   * Departments that are not big enough to send a shopper into yet.
   *
   * Filtered here rather than in the page so that the app's home feed makes the
   * same call — a rail the web has decided is too thin to show is not a rail
   * the app should be showing either, and this module exists precisely so that
   * decision is made once. See `DEPARTMENT_CATALOGUE_MINIMUM`.
   */
  const stockedDepartments = departmentPools.filter(
    (department) => department.total >= DEPARTMENT_CATALOGUE_MINIMUM
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

  /**
   * "New in" — the most recently listed products that came from a SELLER.
   *
   * The distinction from "New arrivals" directly below it on the page is the
   * whole reason this rail exists, and it is worth stating plainly because the
   * two titles sound alike. New arrivals is the newest stock in the shop from
   * any source, most of which is the shop's own. This is the newest stock put up
   * by the independent sellers trading on the marketplace — `product.seller` is
   * set only on those, by WooCommerce, so the filter is a fact rather than a
   * heuristic.
   *
   * Why it earns a place near the top of the homepage: a marketplace lives or
   * dies on sellers believing that listing here gets their goods seen. A rail
   * that shows the newest seller listings, in the second slot on the front page,
   * is the most visible possible answer to that — and it refreshes itself every
   * time anybody lists anything, with no merchandising work at all.
   *
   * Sorted newest first on `date_created`, which is when the listing was
   * created rather than when its stock last changed, so a seller editing an old
   * product cannot push it back to the top of the page.
   */
  const sellerArrivals = [...latest.products]
    .filter((product) => product.seller && product.date_created)
    .sort(
      (a, b) =>
        new Date(b.date_created!).getTime() - new Date(a.date_created!).getTime()
    )
    .slice(0, 12);

  // Trending is the shop's own picks where any are flagged, newest otherwise.
  const trendingPool =
    featured.products.length > 0 ? featured.products : latest.products;

  /**
   * Rails are filled in the order they appear on the page, not the order this
   * object lists them in — see `app/page.tsx`:
   *
   *   trending → New in → Daily Deals → promotions → new arrivals →
   *   best sellers → department rails → Super Deals → the endless grid
   *
   * Order is the whole mechanism. Whatever is claimed first gets the strongest
   * stock, so the sequence here is a merchandising decision and has to track
   * the page. If a section moves in the JSX, it moves here too.
   */
  const ledger = new Ledger();

  const trending = ledger.claim(trendingPool, 12);

  /**
   * Claimed second, because it renders second.
   *
   * Deliberately ahead of the discount rails. A seller's brand-new listing has
   * no sales history and usually no discount, so it loses every other contest on
   * this page — left further down the order it would be picked over by Daily
   * Deals and Promotions and reliably fail its minimum, and the rail would
   * simply never appear. Claiming here is what makes the promise to sellers
   * real rather than nominal.
   */
  const sellerArrivalsRail = ledger.claim(sellerArrivals, 12);

  /**
   * Daily Deals is filled before Promotions because it sits above it in the
   * APP's feed — it no longer appears on the website at all. It used to get
   * `bySaving.slice(24)`, the shallowest discounts in the pool, under a badge
   * announcing the best, which is the bug this ordering was written to fix.
   *
   * It now takes the tier below Super Deals rather than the top one; see the
   * note on that claim directly above for why the web page's only remaining
   * deals shelf outranks a rail the web page does not render.
   *
   * Topped up here rather than by the component. `DailyDeals` accepts a
   * `fallback` list and pads itself from it — and the page was handing it the
   * whole catalogue, which put products from every other rail straight back
   * into it. The top-up now comes from the ledger's unclaimed remainder, so it
   * can only ever add something new.
   */
  /* ---- Super Deals claims FIRST now, and this is a real change ----
   *
   * It used to claim last, with the comment "Super Deals sits near the foot of
   * the page, so it claims last of the rails". That was true and it stopped
   * being true, because the page changed underneath it.
   *
   * The ledger hands each product to one rail only, so claim ORDER is
   * allocation. Super Deals claiming last meant it got what `dailyDeals` (16),
   * `promoProducts` (12) and the department rails had already passed over — so
   * on a catalogue with fewer than about thirty discounted products it received
   * NOTHING, and `SuperDeals` returns null on an empty list. The shop's
   * loudest deals shelf was silently absent, and the yellow ground added to it
   * was invisible for the same reason: there was no section to paint.
   *
   * Two things make it first now. It is the only deals section left on the
   * homepage — Lightning and Clearance were removed — so "deepest cuts" is a
   * promise nothing else is competing to keep. And `dailyDeals`, which used to
   * outrank it because it sat higher on the page, no longer appears on the web
   * page at all; it is still built because `/api/app/home` serves it to the
   * phone app, which is a different screen with its own ordering.
   *
   * So the web page's one deals shelf takes the best twelve, and the app's rail
   * takes the next sixteen. Both are genuinely discounted; only the order
   * changed. */
  const deals = ledger.claim(bySaving, 12);

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

  /**
   * Departments are the one thing on this page exempt from the no-repeats rule.
   *
   * They were not, and it made them disappear. The ledger is all-or-nothing: a
   * rail that cannot reach its minimum from unclaimed stock renders nothing at
   * all. On a catalogue this size the five rails above take almost everything,
   * so "For men" and "For kids" were reliably empty by the time they were
   * filled — the homepage carried one department rail out of three, and the
   * shop's own men's section was invisible on its front page.
   *
   * The exemption is right on its own terms, not just convenient. The ledger
   * exists to stop a shopper meeting the same six products under six different
   * *claims* — Trending, Promotions, New arrivals all say "this is special",
   * and saying it six times about one product is what makes a page feel padded.
   * A department says something different: it says "this is where men's things
   * live". A shirt appearing in Trending and again under For men is not a
   * repetition, it is an answer to a second question.
   *
   * The ledger is still asked first, so a department prefers stock nothing else
   * has shown; it just falls back to its own catalogue rather than vanishing.
   */
  /* ---- Topped up, rather than chosen between ----
   *
   * This was a straight either/or: take the ledger's leftovers if there were
   * at least `DEPARTMENT_MINIMUM` of them, otherwise fall back to the
   * department's own catalogue. Two is a very low bar, and the result was
   * visible on the page — "For men" claimed three unclaimed products, cleared
   * the bar with them, and rendered a three-tile rail under a heading and a
   * "Shop all" button, on a shop whose men's department has plenty of stock.
   * It looked like the catalogue was nearly empty.
   *
   * The bug is the SHAPE of the test, not the number in it. Raising the
   * threshold only moves the cliff: at five, a rail with four fresh products
   * throws all four away and starts again from the top of the department,
   * showing products every other rail has already shown. Both sides of that
   * branch are worse than the obvious third option.
   *
   * So it fills instead. The ledger is still asked first, so a department
   * still prefers stock nothing else on the page has used; whatever it comes
   * up short by is made up from the department's own products, skipping
   * anything already in hand. A rail is now either as full as its department
   * allows or as full as `RAIL_TARGET`, and never a sparse row that happened
   * to clear a threshold.
   *
   * The exemption argued above is what makes the top-up legitimate: a product
   * in Trending and again under For men is not a repetition, because the two
   * are answering different questions. */
  const departmentRails = stockedDepartments.map((department) => {
    const fresh = ledger.claim(department.products, RAIL_TARGET, DEPARTMENT_MINIMUM);
    if (fresh.length >= RAIL_TARGET) return { ...department, products: fresh };

    const alreadyShown = new Set(fresh.map((product) => product.id));
    const topUp = department.products
      .filter((product) => !alreadyShown.has(product.id))
      .slice(0, RAIL_TARGET - fresh.length);

    return { ...department, products: [...fresh, ...topUp] };
  });


  return {
    settings,
    departments,
    storeCount: stores.length,
    trending,
    sellerArrivals: sellerArrivalsRail,
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
