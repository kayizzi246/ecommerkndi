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

        {/* ---- Where the Daily Deals band used to be ----

            The homepage no longer draws it — see the long note in
            `app/page.tsx` — so this skeleton must not draw one either. A
            skeleton's only job is to reserve the height and shape the real page
            will occupy; a bordered band here against a plain rail there is a
            box that appears and a jump at exactly the moment the products land.

            What follows Trending now is the seller-arrivals rail, which is a
            plain rail like the rest. */}
        <ProductRailSkeleton />

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
          <div className="grid grid-cols-2 gap-x-1.5 gap-y-3 sm:grid-cols-3 md:gap-x-3 md:gap-y-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
