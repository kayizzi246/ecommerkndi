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
    // White, like every other section. The band was tinted orange to separate
    // it from the rails above and below; on a page whose job is showing
    // photographs, a hairline border does that job without putting a colour
    // behind sixteen product shots.
    <section
      aria-labelledby="daily-deals-heading"
      className="rounded-2xl border border-shop-line bg-white p-4 md:p-5"
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
      {/* No `px-3` of its own. The section is already padded, and the extra
          gutter held the clock 12px short of the right edge it is aligned to. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
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
          <span className="flex items-center gap-2 rounded-lg bg-shop-hairline px-3 py-1.5 text-shop-sale">
            <span className="text-[12px] font-semibold">Ends in</span>
            <CountdownBlocks />
          </span>
        </div>
      </div>

      <DealCarousel products={deepest.slice(0, MAX_ITEMS)} />
    </section>
  );
}
