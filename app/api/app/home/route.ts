import { buildHomeFeed, MIN_RAIL, type DepartmentRailData } from "@/lib/home-feed";
import { brandName } from "@/lib/site-settings";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import {
  toAppProduct,
  APP_CACHE_HEADERS,
  type AppProduct,
} from "@/lib/app-api";
import type { Product } from "@/lib/woocommerce";

/**
 * The mobile app's homepage, in one request.
 *
 * ## Why one endpoint and not several
 *
 * The app's home screen shows seven rails. Fetched separately that is seven
 * round trips before anything renders, and on a 3G connection in Uganda each
 * one costs real time — the difference between a screen that appears and a
 * screen that assembles itself in front of the user. One payload, one wait.
 *
 * ## Why it is not a generic product API
 *
 * It deliberately mirrors {@link buildHomeFeed} rather than exposing a
 * query interface. If the app could ask for "on sale, sorted by discount, first
 * twelve" it would be re-deciding the merchandising for itself, and the first
 * change to the website's ordering would put the two out of step. Here the
 * server has already decided; the app renders what it is given. That is what
 * makes the two storefronts genuinely the same rather than coincidentally
 * similar.
 *
 * ## Shape
 *
 * Products are flattened by `toAppProduct` in lib/app-api.ts, shared with every
 * other app endpoint so the same product cannot be described two different ways
 * on two different screens.
 */

/** Cached briefly at the edge. See `APP_CACHE_HEADERS`. */
export const revalidate = 60;

/**
 * A rail, with the same title and subtitle the website prints above it.
 *
 * The copy travels with the data rather than being hard-coded in Dart, which is
 * the whole point: change "Best sellers" to something else on the web and the
 * app's heading changes in the same deploy, with no app-store release.
 */
type AppRail = {
  id: string;
  title: string;
  subtitle: string | null;
  /** Web path this rail's "see all" should open. */
  href: string | null;
  products: AppProduct[];
};

function rail(
  id: string,
  title: string,
  subtitle: string | null,
  href: string | null,
  products: Product[],
  minimum = MIN_RAIL
): AppRail | null {
  // Held back below the threshold, exactly as on the web — a two-item "Best
  // sellers" row is a claim the catalogue cannot support.
  if (products.length < minimum) return null;
  return { id, title, subtitle, href, products: products.map(toAppProduct) };
}

function departmentRail(
  department: DepartmentRailData,
  minimum: number
): AppRail | null {
  if (department.products.length < minimum) return null;

  return {
    id: department.id,
    title: department.title,
    subtitle: department.subtitle,
    href: department.slug ? `/category/${department.slug}` : "/categories",
    products: department.products.map(toAppProduct),
  };
}

export async function GET(request: Request) {
  // Public and unauthenticated, so it gets the general API ceiling. Without one
  // this is the cheapest way for anybody to make the shop do a lot of work:
  // each miss composes seven rails out of WooCommerce.
  const limit = rateLimit("app-home", clientIp(request), LIMITS.api);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const feed = await buildHomeFeed();
  const { settings } = feed;

  const rails = [
    rail("trending", "Trending now", null, "/search?sort=popular", feed.trending),
    // "Daily Deals" with the capital D, matching the heading the web component
    // prints verbatim. Casing is exactly the kind of detail that makes two
    // storefronts look like two different products.
    //
    // The fallback to the general catalogue mirrors `DailyDeals`, which tops
    // itself up when there is not enough discounted stock to fill a rail —
    // usually the case on a young shop.
    rail(
      "daily-deals",
      "Daily Deals",
      "Today's reductions",
      "/sale",
      feed.dailyDeals.length >= MIN_RAIL ? feed.dailyDeals : feed.latest
    ),
    rail(
      "promotions",
      "Promotions",
      "Running now across the shop",
      "/sale",
      feed.promoProducts
    ),
    rail(
      "new-arrivals",
      "New arrivals",
      "The latest stock on the shop",
      "/search?sort=newest",
      feed.newArrivals
    ),
    rail(
      "best-sellers",
      "Best sellers",
      "What shoppers here buy most",
      "/search?sort=popular",
      feed.bestSellers
    ),
    ...feed.departmentRails.map((department) =>
      departmentRail(department, feed.departmentMinimum)
    ),
    rail("super-deals", "Super Deals", "Today's deepest cuts", "/sale", feed.deals),
  ].filter((entry): entry is AppRail => entry !== null);

  return Response.json(
    {
      // Versioned from the first release. When the payload has to change
      // incompatibly, older installs are still in shoppers' pockets and the
      // only humane way to handle that is to keep serving them the old shape
      // — which requires knowing which shape they asked for.
      version: 1,
      brand: {
        name: brandName(settings),
        tagline: settings.brand.tagline,
        logoUrl: settings.brand.logo_url || null,
      },
      commerce: {
        freeDeliveryFrom: settings.commerce.free_delivery_from,
        returnsDays: settings.commerce.returns_days,
        currency: "UGX",
      },
      support: {
        phone: settings.support.phone,
        email: settings.support.email,
        whatsapp: settings.support.whatsapp || null,
      },
      // Real categories from the shop, so the app's category strip cannot offer
      // a department the catalogue does not have — the bug the web `/categories`
      // page was built to fix.
      departments: feed.departments
        .filter((department) => (department.count ?? 0) > 0)
        .slice(0, 12)
        .map((department) => ({
          id: department.id,
          name: department.name,
          slug: department.slug,
          count: department.count ?? 0,
          image: department.image ?? null,
        })),
      rails,
      // The endless grid at the foot of the home screen.
      pickedForYou: feed.latest.map(toAppProduct),
      storeCount: feed.storeCount,
    },
    { headers: APP_CACHE_HEADERS }
  );
}
