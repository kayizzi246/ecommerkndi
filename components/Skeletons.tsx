export function ProductCardSkeleton() {
  return (
    <div className="p-1.5">
      {/* Matches ProductCard: a square photo, then the name over two lines and
          the price under it. The text bars matter — a bare square shimmering on
          its own reads as a broken image, where a square with lines beneath it
          reads as a product that has not arrived yet. */}
      <div className="shimmer aspect-square w-full rounded-lg" />
      <div className="shimmer mt-2 h-3 w-[92%] rounded" />
      <div className="shimmer mt-1.5 h-3 w-[64%] rounded" />
      <div className="shimmer mt-2.5 h-4 w-[45%] rounded" />
    </div>
  );
}

/**
 * The heading every homepage section wears, as shimmer — a title bar, a shorter
 * subtitle bar, and the "View All" link on the right.
 */
export function SectionHeaderSkeleton({ withSubtitle = true }: { withSubtitle?: boolean }) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-4 px-3 md:px-0">
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
      <div className="flex gap-px overflow-hidden">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="w-[35.7%] shrink-0 sm:w-[31%] md:w-[23.5%] lg:w-[18.5%] xl:w-[15.8%]"
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
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
