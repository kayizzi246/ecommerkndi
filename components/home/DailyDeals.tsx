import type { Product } from "@/lib/woocommerce";
import { discountPercent } from "@/lib/currency";
import DealCarousel from "@/components/DealCarousel";
import CountdownBlocks from "@/components/home/CountdownBlocks";

/** Below this many items the rail looks like a mistake rather than a section. */
const MIN_ITEMS = 6;
const MAX_ITEMS = 16;

/**
 * Daily Deals — the day's best value, as a carousel on a tinted band.
 *
 * Discounted stock leads, ordered by how much is actually off rather than by
 * date, because that is the question the section title raises. Products already
 * shown in Super Deals are filtered out upstream, so a shopper scrolling the
 * homepage does not meet the same five products three times over.
 *
 * When the catalogue has little on sale — which is most days for a shop this
 * size — the rail is topped up with the lowest-priced stock instead of
 * disappearing, and the badge changes with it: "Up to 60% OFF" only when
 * something really is 60% off, "Lowest prices today" otherwise. A deals strip
 * that quietly relabels full-price goods as discounts is the fastest way to
 * teach shoppers to ignore the word here.
 *
 * The tint is what separates it from the rails above and below without another
 * heading treatment — the page has one heading style and keeps it.
 */
export default function DailyDeals({
  products,
  /** Stock to fill with when there is not enough on sale. */
  fallback = [],
}: {
  products: Product[];
  fallback?: Product[];
}) {
  const deepest = [...products].sort(
    (a, b) =>
      discountPercent(b.regular_price, b.price) - discountPercent(a.regular_price, a.price)
  );

  if (deepest.length < MIN_ITEMS) {
    const seen = new Set(deepest.map((product) => product.id));
    const cheapest = fallback
      .filter((product) => !seen.has(product.id))
      .sort((a, b) => a.price - b.price);
    deepest.push(...cheapest.slice(0, MIN_ITEMS - deepest.length));
  }

  if (deepest.length === 0) return null;

  const best = discountPercent(deepest[0].regular_price, deepest[0].price);

  return (
    /**
     * ---- The band ----
     *
     * Dark, and the products on a white shelf inside it.
     *
     * Every previous attempt fought the same constraint from the wrong side. A
     * solid orange slab, then a red gradient, both put colour *behind* sixteen
     * product photographs; a plain white card avoided that and made the only
     * section on the page claiming a deadline look exactly like the four rails
     * around it that claim nothing. Tinting harder makes the cast worse and
     * tinting softer makes the section disappear — the two directions cancel.
     *
     * Near-black breaks the trade. It is not a hue, so nothing on it reads as
     * "warm" or "cool" the way a wash of orange does, and it is the strongest
     * possible frame for the one thing this rail is selling: urgency. The
     * merchandise never touches it — the tiles sit on a white panel with its
     * own corners, so the photographs have exactly the ground they have in
     * every other rail on the site, and the dark is a mount around them rather
     * than a filter over them.
     *
     * Edge to edge on a phone, a rounded card from md, like every other band
     * here.
     */
    <section
      aria-labelledby="daily-deals-heading"
      className="overflow-hidden bg-gradient-to-b from-[#26262b] to-bfl-black p-3 md:rounded-2xl md:p-5"
    >
      {/* ---- Header ----
           Two things on one line at every width now, which is what removing
           "View All" from here bought.

           It was four — title, badge, clock, link — and at 390px they did not
           fit, so the clock wrapped to a second line of its own. With the link
           gone to the end of the rail (where a shopper who has seen the deals
           is the one being offered more of them), the title and the clock sit
           on one line with the clock hard against the right edge: the eye
           crosses the heading left to right and lands on the deadline last. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {/* White on near-black. `heading-black` still carries the weight. */}
          <h2
            id="daily-deals-heading"
            className="heading-black text-[18px] text-white md:text-[20px]"
          >
            Daily Deals
          </h2>

          <span className="rounded-full bg-shop-sale px-2.5 py-1 text-[12px] font-bold text-white">
            {best > 0 ? `Up to ${best}% OFF` : "Lowest prices today"}
          </span>
        </div>

        {/* One 24-hour cycle, resetting at midnight on the viewer's clock — the
            same window Super Deals runs on, because both rails are rebuilt from
            WooCommerce's on-sale stock and rebuilt together. */}
        <span className="flex shrink-0 items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-white ring-1 ring-white/15">
          <span className="hidden text-[12px] font-semibold sm:inline">Ends in</span>
          <CountdownBlocks />
        </span>
      </div>

      {/* The white shelf. The dark is a mount around the products, never a
          ground beneath them: inside this panel a tile has exactly the white it
          has in every other rail on the site. */}
      <div className="rounded-xl bg-white p-2 pb-1 md:p-3">
        <DealCarousel
          products={deepest.slice(0, MAX_ITEMS)}
          viewAll={{ href: "/sale", label: "See all deals" }}
        />
      </div>
    </section>
  );
}
