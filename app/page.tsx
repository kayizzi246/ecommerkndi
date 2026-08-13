import {
  getProductsSafe,
  getStores,
  getCategories,
  buildCategoryTree,
} from "@/lib/woocommerce";
import { findCategorySlug } from "@/lib/departments";
import DepartmentRail from "@/components/home/DepartmentRail";
import DealCarousel from "@/components/DealCarousel";
import SuperDeals from "@/components/home/SuperDeals";
import DailyDeals from "@/components/home/DailyDeals";
import SectionHeader from "@/components/home/SectionHeader";
import InfiniteProducts from "@/components/home/InfiniteProducts";
import TrustBar from "@/components/home/TrustBar";
import SellWithUs from "@/components/home/SellWithUs";
import { getSiteSettings, brandName } from "@/lib/site-settings";
import { discountPercent, formatPrice } from "@/lib/currency";
import Link from "next/link";
import type { Metadata } from "next";

/**
 * The homepage is canonical to itself, and says so explicitly.
 *
 * Not inherited from the layout any more: metadata set there applies to every
 * page under it, which is how every policy page ended up claiming to be this
 * one. The title and description still come from the layout, where they are
 * built from the shop's wp-admin branding.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
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
    // The department tree, so the Men/Women/Kids rails can find the shop's real
    // categories. The layout asks for this too and Next dedupes identical
    // fetches within a render, so it is one request rather than two.
    getCategories().then(buildCategoryTree),
  ]);

  /**
   * Men, Women and Kids — the three departments almost every shopper arrives
   * already knowing they want.
   *
   * The slugs are resolved from the shop's own catalogue rather than assumed,
   * because a shop that has not created a Kids category yet must not get a rail
   * that links nowhere. `findCategorySlug` is the same matcher the header nav
   * uses, so the rail and the link above it can never disagree about which
   * category a word means.
   *
   * Fetched in one parallel batch after the tree is known — three sequential
   * round trips would cost the page more than the rails are worth. A department
   * the shop does not have resolves to null, fetches nothing, and the rail
   * simply does not render.
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

  const departmentRails = await Promise.all(
    DEPARTMENTS.map(async (department) => {
      const slug = findCategorySlug(departments, department.match);
      if (!slug) return { ...department, slug: null, products: [] };

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
   * Promotions — it is the highest rail of the three on the page, so it should
   * carry the strongest stock.
   */
  const bySaving = [...onSale.products].sort(
    (a, b) =>
      discountPercent(b.regular_price, b.price) -
      discountPercent(a.regular_price, a.price)
  );

  const promoProducts = bySaving.slice(0, 12);
  const deals = bySaving.slice(12, 24);
  const dailyDeals = bySaving.slice(24);

  /**
   * New arrivals and Best sellers.
   *
   * Both are sorted from the catalogue rather than fetched separately — the
   * homepage already holds the newest two dozen products, and a third and
   * fourth WooCommerce round trip to re-sort the same rows would cost the page
   * its speed for nothing.
   *
   * Each is held back until it has enough stock to look like a rail rather than
   * a mistake, and best sellers needs products that have genuinely sold: a
   * "best sellers" row of items nobody has bought is the kind of small lie that
   * teaches shoppers to distrust the rest of the page.
   */
  const MIN_RAIL = 4;

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
  // "Picked for you" below is the whole catalogue, so overlap there is expected
  // and fine — it is the endless grid, not a curated rail.
  const trendingPool = featured.products.length > 0 ? featured.products : latest.products;
  const trending = trendingPool.slice(0, 12);

  /** Brand plus suffix, spaced — for the closing about block. */
  const brand = brandName(settings);

  return (
    <main className="pb-20">
      {/* The page opens on merchandise.

          The hero banner and category card grid went first; the department
          chips and the coloured promo tiles have now followed them. All four
          were navigation dressed as content, and they pushed the first real
          product below the fold on every phone. The departments are one tap
          away in the header, which is where a shopper looks for them.

          Spacing is tight and even: 16px on a phone, 28px from md up. The old
          36px desktop gap left the page feeling like separate pages stacked. */}
      {/* Edge to edge on a phone, padded from md up.

          The side gutter used to be 12px, which bought nothing: it cost a
          product card most of its width on a 390px screen while the rails
          bled past it anyway with a 16px negative margin — 4px wider than the
          screen on each side, which is what made the whole page drift
          sideways. Removing the gutter fixes the drift and gives the width
          back to the products. Headings and copy carry their own `px-3` so
          words never touch the glass. */}
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-0 py-4 md:gap-7 md:px-8 md:py-5">
        {trending.length > 0 && (
          <section id="trending" className="scroll-mt-32">
            <SectionHeader title="Trending now" href="/search?sort=popular" />
            {/* The first rail on the page, and so the one carrying the largest
                paint. Its leading tiles load eagerly; every rail below stays
                lazy. */}
            <DealCarousel products={trending} priority />
          </section>
        )}

        {/* Deals sit directly under Trending: the rail above is what is popular,
            this is what is cheap today, and those are the two reasons a shopper
            keeps scrolling a homepage. */}
        <DailyDeals products={dailyDeals} fallback={latest.products} />

        {/* What is on promotion, as the products themselves.

            This was a rail of coloured campaign cards — a badge, a headline and
            a "Shop now" arrow per card. Every one of them was a claim a shopper
            had to click through to test, on a page whose whole job is showing
            stock. The rail now carries the discounted products directly, in the
            same tiles as every other rail, so the offer is the price rather
            than a sentence about a price. */}
        {promoProducts.length >= MIN_RAIL && (
          <section aria-labelledby="promotions-heading">
            <SectionHeader
              id="promotions-heading"
              title="Promotions"
              subtitle="Running now across the shop"
              href="/sale"
              linkLabel="All offers"
            />
            <DealCarousel products={promoProducts} />
          </section>
        )}

        {/* A row of cards is a claim; these are the products a shopper can act
            on without leaving the page. */}
        {newArrivals.length >= MIN_RAIL && (
          <section aria-labelledby="new-arrivals-heading">
            <SectionHeader
              id="new-arrivals-heading"
              title="New arrivals"
              subtitle="The latest stock on the shop"
              href="/search?sort=newest"
            />
            <DealCarousel products={newArrivals} />
          </section>
        )}

        {bestSellers.length >= MIN_RAIL && (
          <section aria-labelledby="best-sellers-heading">
            <SectionHeader
              id="best-sellers-heading"
              title="Best sellers"
              subtitle="What shoppers here buy most"
              href="/search?sort=popular"
            />
            <DealCarousel products={bestSellers} />
          </section>
        )}

        {/* The three departments a shopper usually arrives already knowing they
            want. Placed after the discount and novelty rails deliberately:
            those answer "what is worth having today", which is what keeps
            somebody scrolling, and these answer "where do I go for my own
            things", which is what they scroll *to*. Any department the shop has
            not created simply does not appear. */}
        {departmentRails.map((department) => (
          <DepartmentRail
            key={department.id}
            id={department.id}
            title={department.title}
            subtitle={department.subtitle}
            chip={department.chip}
            tone={department.tone}
            href={department.slug ? `/category/${department.slug}` : "/categories"}
            products={department.products}
            /**
             * Two, not the four the curated rails ask for.
             *
             * A department is a promise about where things live rather than a
             * merchandising claim, so a thin one is a shop that is still
             * filling up — worth showing — where a two-item "Best sellers" rail
             * would be a claim the catalogue cannot support. This shop has two
             * men's products today; at a threshold of four the department a
             * shopper is most likely to be looking for would be invisible.
             */
            minimum={2}
          />
        ))}

        <SuperDeals products={deals} />

        {/* The wide orange offer slab used to sit here, between Super Deals and
            the endless grid. It carried the shop's terms — free delivery over a
            threshold, pay on delivery, the returns window — and those are worth
            saying, so they have not been lost: TrustBar below states pay on
            delivery and returns, and the masthead and footer both carry the
            free-delivery threshold from settings. None of them needs a
            full-width advertisement in the middle of the merchandise. */}

        <section>
          <SectionHeader title="Picked for you" />
          <InfiniteProducts
            initialProducts={latest.products}
            totalPages={latest.total_pages}
          />
        </section>

        <TrustBar />

        {/* Recruiting sellers at the foot of the page, after a shopper has seen
            what the shop looks like — the trader worth having is the one who
            liked the catalogue first. */}
        <SellWithUs settings={settings} storeCount={stores.length} />

        {/* ---- About the shop, at the foot of the page ----
         *
         * The homepage `<h1>` lives here rather than above the first rail.
         *
         * It still does its whole SEO job from the bottom of the document: an
         * `<h1>` is read by position in the outline, not by position on the
         * screen, and this is the page that ranks for the shop's own name and
         * for "online shopping Uganda". What moving it down buys is that the
         * page opens on merchandise, which is what the layout above was built
         * for in the first place.
         *
         * The prose underneath is not filler. A homepage that is otherwise
         * nothing but product tiles gives a crawler almost no text to read, and
         * this is where the shop says in plain sentences what it sells, where
         * it delivers and how payment works — the phrases people actually type
         * into Google. Every figure in it comes from the shop's own settings,
         * so it cannot drift away from what the checkout does.
         */}
        <section
          aria-labelledby="about-kandi"
          className="mt-4 border-t border-shop-line px-4 pt-10 text-center md:px-8"
        >
          <h1
            id="about-kandi"
            className="mx-auto max-w-[62ch] text-[17px] leading-snug text-shop-body md:text-[19px]"
          >
            <span className="heading-black block text-[20px] text-shop-ink md:text-[24px]">
              {brandName(settings)}
            </span>
            <span className="mt-1.5 block">
              {"Online shopping in Uganda. "}
              <span className="font-bold text-shop-ink">
                Fast delivery, pay on delivery
              </span>
              {` and ${settings.commerce.returns_days}-day returns.`}
            </span>
          </h1>

          <div className="mx-auto mt-5 max-w-[68ch] space-y-3.5 text-[15px] leading-relaxed text-shop-body">
            <p>
              {brand} is a Ugandan online marketplace selling shoes, clothing,
              electronics, home essentials and more — from our own shelves and
              from independent Ugandan stores approved to sell alongside us.
              Every listing is checked before it goes live, and every seller is
              vetted individually, so a low price here is a real one rather than
              a risk.
            </p>
            <p>
              We deliver countrywide. Orders around Kampala usually arrive within
              one to two working days and upcountry within five, with{" "}
              <span className="font-semibold text-shop-ink">
                free delivery on orders over {formatPrice(settings.commerce.free_delivery_from)}
              </span>
              . Pay however suits you: cash to the courier on delivery, MTN Mobile
              Money, Airtel Money, or by card at checkout.
            </p>
            <p>
              Changed your mind? You have{" "}
              <span className="font-semibold text-shop-ink">
                {settings.commerce.returns_days} days
              </span>{" "}
              from delivery to send an item back, and if it arrives faulty or
              wrong we cover the courier both ways.{" "}
              <Link href="/about" className="font-semibold text-shop-primary hover:underline">
                More about us
              </Link>
              {" · "}
              <Link href="/shipping" className="font-semibold text-shop-primary hover:underline">
                Delivery
              </Link>
              {" · "}
              <Link href="/returns" className="font-semibold text-shop-primary hover:underline">
                Returns
              </Link>
              {" · "}
              <Link href="/help" className="font-semibold text-shop-primary hover:underline">
                Help centre
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
