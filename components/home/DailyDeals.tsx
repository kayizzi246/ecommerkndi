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
     * The same band the department rails wear, in sale red.
     *
     * This section has now been an orange slab, a white card, a red gradient
     * and a near-black frame, and the last of those was the mistake this one
     * corrects: it was a *different* idea from everything around it. The
     * homepage already had an answer for "a section that needs to stand apart
     * without putting colour behind a photograph" — the Men, Women and Kids
     * bands — and Daily Deals inventing a second answer to the same question
     * meant the page carried two competing treatments and read as two pages
     * stacked.
     *
     * So it is the department band exactly: a tint at full strength behind the
     * heading, faded to white before the first tile, a white disc holding a
     * glyph, edge to edge on a phone and rounded from md. Red rather than blue
     * or violet, because that is the shop's discount colour and this is the
     * discount rail. Nothing else differs — the tiles are the tiles.
     */
    <section
      aria-labelledby="daily-deals-heading"
      className="overflow-hidden bg-gradient-to-b from-pop-red-soft via-white to-white pt-3 md:rounded-2xl md:pt-4"
    >
      {/* 12px, matching `SectionHeader` — this rail draws its own heading rather
          than using that component, so the homepage's spacing ratio has to be
          repeated here by hand or the tinted sections drift looser than the
          plain ones. See `app/page.tsx`. */}
      <div className="mb-3 flex items-center gap-3 px-3 md:px-5">
        {/* The disc, matching the department rails. A price tag: the one glyph
            that means "this costs less" without a word. */}
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-shop-primary-ink ring-1 ring-black/5">
          <svg
            aria-hidden
            className="h-[22px] w-[22px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M3.5 12.5 11 5h8v8l-7.5 7.5a1.5 1.5 0 0 1-2.1 0l-5.9-5.9a1.5 1.5 0 0 1 0-2.1ZM15.5 9h.01" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2
              id="daily-deals-heading"
              className="heading-black text-[18px] text-shop-ink md:text-[20px]"
            >
              Daily Deals
            </h2>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-shop-primary-ink">
              {best > 0 ? `Up to ${best}% off` : "Lowest today"}
            </span>
          </div>
          <p className="section-sub mt-0.5 truncate text-[13px]">
            Today&rsquo;s reductions, gone at midnight
          </p>
        </div>

        {/* Where "Shop all" sits on a department rail. It is the same shape and
            the same position, because it answers the same question — what is
            the one thing worth knowing about this rail — and here that is the
            deadline rather than a link. One 24-hour cycle, resetting at
            midnight on the viewer's clock. */}
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-shop-ink px-3 py-2 text-white">
          <span className="hidden text-[11.5px] font-semibold sm:inline">Ends in</span>
          <CountdownBlocks />
        </span>
      </div>

      <DealCarousel
        products={deepest.slice(0, MAX_ITEMS)}
        viewAll={{ href: "/sale", label: "See all deals" }}
      />
    </section>
  );
}
