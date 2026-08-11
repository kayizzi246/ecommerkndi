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
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="daily-deals-heading" className="heading-black text-[18px] text-shop-ink md:text-[20px]">
            Daily Deals
          </h2>

          <span className="rounded-full bg-shop-sale px-2.5 py-1 text-[12px] font-bold text-white">
            {best > 0 ? `Up to ${best}% OFF` : "Lowest prices today"}
          </span>

          {/* The same midnight clock as Super Deals: both rails are rebuilt from
              what WooCommerce has on sale, and they are rebuilt together. */}
          <span className="flex items-center gap-2 rounded-lg bg-shop-hairline px-3 py-1.5 text-shop-sale">
            <span className="text-[12px] font-semibold">Ends in</span>
            <CountdownBlocks />
          </span>
        </div>

        <Link
          href="/sale"
          className="flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-shop-primary transition-colors hover:text-shop-primary-dark"
        >
          View All
          <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
        </Link>
      </div>

      <DealCarousel products={deepest.slice(0, MAX_ITEMS)} />
    </section>
  );
}
