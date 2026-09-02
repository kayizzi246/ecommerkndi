/**
 * The product page, as shimmer.
 *
 * Every measurement here is copied from `ProductPurchase` rather than chosen —
 * the 1200px row cap, the 44% gallery column, the 560px frame cap, the 32px
 * column gap. A placeholder that is a different shape from what replaces it
 * makes the page visibly re-lay-out when the data lands, which reads as a bug
 * rather than as loading, and on the product page it happens directly under the
 * shopper's thumb.
 *
 * Deliberately does NOT shimmer the tabs and the recommendation rails below the
 * fold. Everything on screen at once should be placeholder; a screenful of
 * shimmer that continues past where the eye stops is just noise, and it costs
 * markup on the one page in the shop with the most of it already.
 */
export default function ProductPageSkeleton() {
  return (
    <main className="bg-white pb-20 pt-3 lg:pb-12">
      <div className="mx-auto max-w-[var(--shell)] px-4 md:px-8">
        {/* Breadcrumbs. Three short bars, because that is what the real trail
            is on nearly every product: Home / Department / Name. */}
        <div className="mb-3 flex items-center gap-2">
          <div className="shimmer h-3 w-10 rounded" />
          <div className="shimmer h-3 w-3 rounded" />
          <div className="shimmer h-3 w-20 rounded" />
          <div className="shimmer h-3 w-3 rounded" />
          <div className="shimmer h-3 w-32 rounded" />
        </div>

        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 lg:grid lg:grid-cols-[44%_1fr] lg:items-start lg:gap-x-8">
          {/* Gallery */}
          <div className="w-full">
            <div className="mx-auto w-full max-w-[560px] lg:mx-0">
              <div className="shimmer aspect-square w-full rounded-xl" />
              {/* The thumbnail rail under it — four, which is the commonest
                  count in this catalogue. */}
              <div className="mt-2.5 flex gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="shimmer h-16 w-16 shrink-0 rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          {/* Buy box */}
          <div className="w-full">
            {/* Title: two lines, because product names in this catalogue are
                long enough to wrap and reserving one line guarantees a jump. */}
            <div className="shimmer h-5 w-[92%] rounded" />
            <div className="shimmer mt-2 h-5 w-[60%] rounded" />

            <div className="shimmer mt-4 h-3.5 w-28 rounded" />

            {/* Price row, then the saving line under it. */}
            <div className="mt-5 flex items-center gap-3">
              <div className="shimmer h-7 w-32 rounded" />
              <div className="shimmer h-4 w-24 rounded" />
              <div className="shimmer h-6 w-20 rounded-full" />
            </div>
            <div className="shimmer mt-2.5 h-3.5 w-40 rounded" />

            {/* The delivery and returns panel. */}
            <div className="shimmer mt-5 h-20 w-full rounded-xl" />

            <div className="shimmer mt-5 h-3.5 w-28 rounded" />

            {/* Quantity, then the two buttons at the height they really are. */}
            <div className="mt-3 flex items-center gap-3">
              <div className="shimmer h-11 w-32 rounded-lg" />
              <div className="shimmer h-11 w-11 rounded-lg" />
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="shimmer h-14 flex-1 rounded-full" />
              <div className="shimmer h-14 flex-1 rounded-full" />
            </div>

            <div className="shimmer mt-6 h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
