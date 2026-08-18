import { ProductRailSkeleton, ProductCardSkeleton } from "@/components/Skeletons";

/**
 * The homepage while its data is in flight.
 *
 * Next renders this automatically in place of `page.tsx` until the server
 * components above it resolve, so it is the first thing a shopper on a Ugandan
 * mobile connection sees — often for a second or two. What it shows therefore
 * matters: a blank screen reads as a site that is broken, and a spinner reads
 * as a site that is thinking. A shimmer in the *shape of the page* reads as a
 * site that is nearly ready, and it is the only one of the three that tells the
 * shopper anything true.
 *
 * Every section of the real homepage is mirrored here in the same order and at
 * the same widths — rails, the bordered Daily Deals band, the endless grid, the
 * trust bar and the seller band. Matching the geometry is the point: when the
 * products land they occupy the boxes the shimmer was already holding, so the
 * page fills in rather than jumping, and nothing the shopper was about to tap
 * moves out from under their thumb.
 *
 * The `.shimmer` sweep is switched off under `prefers-reduced-motion` in
 * globals.css, where the plates stay as flat grey — still a layout, just not a
 * moving one.
 */
export default function HomeLoading() {
  return (
    <main className="pb-20">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-0 py-4 md:gap-7 md:px-8 md:py-5">
        {/* Trending now — the first rail, and the one carrying the page's
            largest paint. */}
        <ProductRailSkeleton withSubtitle={false} />

        {/* Daily Deals sits on its own bordered band, so its skeleton does too
            — without the border the page would visibly gain a box when the real
            section arrived. */}
        <section className="rounded-2xl border border-shop-line bg-white p-4 md:p-5">
          <div className="mb-3.5 flex flex-wrap items-center gap-3 px-3 md:px-0">
            <div className="shimmer h-5 w-32 rounded md:h-6" />
            <div className="shimmer h-6 w-28 rounded-full" />
            <div className="shimmer h-7 w-36 rounded-lg" />
          </div>
          {/* Matches DealCarousel's gap. A skeleton whose gaps differ from the
              real rail's is a layout shift the moment the products land. */}
          <div className="flex gap-2 overflow-hidden sm:gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="w-[48.5%] shrink-0 sm:w-[31%] md:w-[23.5%] lg:w-[18.5%] xl:w-[15.8%]"
              >
                <ProductCardSkeleton />
              </div>
            ))}
          </div>
        </section>

        {/* Promotions, New arrivals, Best sellers. */}
        <ProductRailSkeleton />
        <ProductRailSkeleton />
        <ProductRailSkeleton />

        {/* The three department rails — Men, Women, Kids. */}
        <ProductRailSkeleton />
        <ProductRailSkeleton />
        <ProductRailSkeleton />

        {/* Super Deals. */}
        <ProductRailSkeleton />

        {/* Picked for you — a grid rather than a rail, so it wraps. */}
        <section>
          <div className="mb-3.5 px-3 md:px-0">
            <div className="shimmer h-5 w-36 rounded md:h-6 md:w-44" />
          </div>
          {/* The shared product-grid rhythm, for the same reason. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-x-3 md:gap-y-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </section>

        {/* The four promises, then the seller recruitment band. */}
        <section className="rounded-2xl border border-shop-line bg-white px-4 py-6 md:px-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="shimmer h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="shimmer h-3.5 w-24 rounded" />
                  <div className="shimmer mt-2 h-3 w-32 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="shimmer h-40 rounded-2xl md:h-48" />
      </div>
    </main>
  );
}
