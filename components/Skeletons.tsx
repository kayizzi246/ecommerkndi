import { PRODUCT_GRID } from "@/lib/product-grid";

export function ProductCardSkeleton() {
  return (
    <div className="store-product-card tile-card" aria-hidden>
      <div className="shimmer aspect-square w-full" />
      <div className="store-card-body">
        <div className="shimmer h-9 w-full rounded" />
        <div className="store-card-pricing"><div className="shimmer h-5 w-2/3 rounded" /><div className="shimmer mt-1 h-3 w-1/2 rounded" /></div>
        <div className="shimmer h-4 w-3/4 rounded" />
        <div className="shimmer h-[18px] w-1/2 rounded" />
        <div className="shimmer mt-auto h-[38px] w-full rounded-[7px]" />
        <div className="h-[14px]" />
      </div>
    </div>
  );
}

/**
 * The heading every homepage section wears, as shimmer — a title bar, a shorter
 * subtitle bar, and the "View All" link on the right.
 */
export function SectionHeaderSkeleton({ withSubtitle = true }: { withSubtitle?: boolean }) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="shimmer h-5 w-40 rounded md:h-6 md:w-52" />
        {withSubtitle && <div className="shimmer mt-2 h-3 w-56 rounded" />}
      </div>
      <div className="shimmer h-3.5 w-16 shrink-0 rounded" />
    </div>
  );
}

/**
 * One product rail: a section heading over a row of tiles.
 *
 * The tile widths deliberately mirror {@link DealCarousel}'s defaults, so the
 * shimmer occupies the same columns the real products will — the row does not
 * reflow when the data lands, which is what makes a skeleton feel like the page
 * loading rather than the page changing its mind.
 */
export function ProductRailSkeleton({
  count = 6,
  withSubtitle = true,
}: {
  count?: number;
  withSubtitle?: boolean;
}) {
  return (
    <section>
      <SectionHeaderSkeleton withSubtitle={withSubtitle} />
      {/* Matches DealCarousel's gap, so the rail does not jump when the real
          tiles replace these. */}
      {/* 8px, matching the rail. It claimed to match and did not, which on a
          phone was 2px × 2 gaps of drift under a tile width that is measured
          FROM the gaps — so the shimmer sat where the products would not. */}
      <div className="flex gap-2 overflow-hidden sm:gap-3">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            // `shrink-0sm:w-[31%]` — a missing space that made one unparseable
            // class out of two, so these placeholders were free to shrink and
            // never took their tablet width. The rail they stand in for is
            // `shrink-0` at fixed widths, and a skeleton that is not laid out
            // like the thing it precedes is a guaranteed shift.
            // The phone step is the rail's 2.3-tile calc verbatim, gaps and
            // all — that is the width the products land at, and a skeleton one
            // tile-count off is a guaranteed shift at the exact moment the
            // shopper is looking at it. The steps above it still drift from the
            // rail by a point or so and are left alone here.
            className="w-[calc((100vw-40px)/2.3)] min-w-0 shrink-0 sm:w-[31%] md:w-[23.5%] lg:w-[18.5%] xl:w-[15.8%]"
          >
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={PRODUCT_GRID}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListingPageSkeleton() {
  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      <div className="shimmer h-8 w-56 rounded mb-3" />
      <div className="shimmer h-4 w-28 rounded mb-10" />
      <ProductGridSkeleton count={12} />
    </main>
  );
}
