export function ProductCardSkeleton() {
  return (
    // A white card on a phone and flat from md up, because that is what
    // `ProductCard` is again — the padding and both radii are copied from it
    // deliberately. A placeholder that is a different shape from what replaces
    // it makes the grid visibly re-draw itself when the products land, which
    // reads as a layout bug rather than as loading.
    <div className="bg-white p-1.5 md:bg-transparent md:p-0">
      {/* Matches ProductCard row for row: the photo at its square box, ONE line of
          name, the short sold-and-rating line, then the price. The ratio is the
          part that has to track — it is nearly all of the tile's height, so a
          skeleton at the wrong one is a grid that jumps when the products land.
          The text bars matter too: a bare box shimmering on its own reads as a
          broken image, where a box with lines beneath it reads as a product on
          its way. 8px corners on the photo box, matching the tile's — see ProductCard. */}
      <div className="shimmer aspect-square w-full rounded-lg" />
      <div className="shimmer mt-1.5 h-3.5 w-[88%] rounded" />
      <div className="shimmer mt-[7px] h-2.5 w-[45%] rounded" />
      <div className="shimmer mt-[7px] h-4 w-[58%] rounded" />
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
      {/* 10px, not 8px. This claimed to match the rail and did not, which on a
          phone is 2px × 2 gaps of drift under a tile width that is now measured
          FROM the gaps — so the shimmer sat where the products would not. */}
      <div className="flex gap-2.5 overflow-hidden sm:gap-3">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            // `shrink-0sm:w-[31%]` — a missing space that made one unparseable
            // class out of two, so these placeholders were free to shrink and
            // never took their tablet width. The rail they stand in for is
            // `shrink-0` at fixed widths, and a skeleton that is not laid out
            // like the thing it precedes is a guaranteed shift.
            // The phone step is the rail's 2.6-tile calc verbatim, gaps and
            // all — that is the width the products land at, and a skeleton one
            // tile-count off is a guaranteed shift at the exact moment the
            // shopper is looking at it. The steps above it still drift from the
            // rail by a point or so and are left alone here.
            className="w-[calc((100%-20px)/2.6)] min-w-0 shrink-0 sm:w-[31%] md:w-[23.5%] lg:w-[18.5%] xl:w-[15.8%]"
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
    <div className="grid grid-cols-2 gap-x-1.5 gap-y-3 sm:grid-cols-3 md:gap-x-3 md:gap-y-5 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">
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
