import Link from "next/link";
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
     * This section has been three things now, and the history is the argument.
     *
     * It began as a solid orange slab, which was wrong: a saturated block
     * running the full height of a rail puts a colour cast behind sixteen
     * product photographs, and on a page whose entire job is showing stock that
     * is the one thing it cannot do. It was then flattened to a white card with
     * a hairline border, which fixed the cast and lost the point — Daily Deals
     * is the only section on the homepage making a claim about *time*, and it
     * looked exactly like the four rails around it that do not.
     *
     * So: a tint that dies before the merchandise. The red is at full strength
     * where the heading and the clock are, has faded to white by the time the
     * first tile begins, and no photograph sits on anything but white. The
     * 3px sale-red rule along the top is what carries at a glance while
     * scrolling — one line of the colour the whole section is about.
     *
     * Edge to edge on a phone, a rounded card from md, which is how every other
     * band on this page behaves. It was an inset card at every width, so on a
     * 390px screen it gave up 32px of product width to a border nobody needed.
     */
    <section
      aria-labelledby="daily-deals-heading"
      className="overflow-hidden border-t-[3px] border-shop-sale bg-gradient-to-b from-pop-red-soft via-white to-white pt-4 md:rounded-2xl md:border md:border-t-[3px] md:border-shop-line md:border-t-shop-sale md:pt-5"
    >
      {/* ---- Header ----
           One wrapping flex row, ordered differently at each width.

           On a phone the four things — title, badge, clock, View All — do not
           fit on one line, and the clock was the piece that lost: it wrapped
           into the middle of the second line, next to nothing, reading as an
           orphan. It is now given the whole second line and pinned to the right
           edge, which is where a countdown belongs — the eye tracks left to
           right across the title and lands on the deadline last.

           From md up there is room for one line, and the clock steps back
           beside the badge with View All at the far right, as before. `order`
           does that without rendering the timer twice: two mounted clocks would
           be two intervals and two elements a screen reader announces. */}
      {/* The gutter lives here rather than on the section, so the rail below
          can run to the glass on a phone while the words never touch it. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 md:px-5">
        <h2
          id="daily-deals-heading"
          className="order-1 heading-black text-[18px] text-shop-ink md:text-[20px]"
        >
          Daily Deals
        </h2>

        <span className="order-2 rounded-full bg-shop-sale px-2.5 py-1 text-[12px] font-bold text-white">
          {best > 0 ? `Up to ${best}% OFF` : "Lowest prices today"}
        </span>

        <Link
          href="/sale"
          className="order-3 ml-auto flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-shop-primary transition-colors hover:text-shop-primary-dark md:order-4"
        >
          View All
          <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
        </Link>

        {/* `w-full` is what forces the break below md — the row has nowhere left
            to put it, so it takes a line of its own and `justify-end` sends it
            to the edge. From md it is an ordinary inline item again. */}
        <div className="order-4 flex w-full justify-end md:order-3 md:w-auto">
          {/* One 24-hour cycle, resetting at midnight on the viewer's clock —
              the same window Super Deals runs on, because both rails are
              rebuilt from WooCommerce's on-sale stock and rebuilt together. */}
          {/* White, not the grey it wore on the old white card: on the tinted
              band a grey pill reads as disabled, where a white one reads as a
              plate sitting on the colour. */}
          <span className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-shop-sale shadow-sm ring-1 ring-black/5">
            <span className="text-[12px] font-semibold">Ends in</span>
            <CountdownBlocks />
          </span>
        </div>
      </div>

      {/* A hair of padding under the rail so the last line of a tile is not
          flush against the card's own edge from md up. */}
      <div className="pb-1 md:pb-4">
        <DealCarousel products={deepest.slice(0, MAX_ITEMS)} />
      </div>
    </section>
  );
}
