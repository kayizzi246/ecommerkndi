export default function Loading() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5 md:px-8">
      <div className="shimmer mb-5 h-3 w-72 rounded" />

      <div className="flex flex-col gap-8 rounded-lg border border-shop-line bg-white p-5 md:p-8 lg:flex-row lg:gap-12">
        {/* Gallery skeleton */}
        <div className="w-full lg:basis-1/2">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="shimmer aspect-square w-full rounded-lg" />
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="shimmer h-16 w-16 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Buy box skeleton */}
        <div className="w-full space-y-4 lg:basis-1/2">
          <div className="shimmer h-3 w-24 rounded" />
          <div className="shimmer h-7 w-4/5 rounded" />
          <div className="shimmer h-8 w-40 rounded" />
          <div className="shimmer h-14 w-full rounded-xl" />
          <div className="flex flex-wrap gap-2 pt-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="shimmer h-10 w-14 rounded-lg" />
            ))}
          </div>
          <div className="shimmer h-12 w-36 rounded-lg" />
          <div className="shimmer h-14 w-full rounded-[10px]" />
          <div className="shimmer h-20 w-full rounded-xl" />
        </div>
      </div>

      <div className="shimmer mt-12 h-64 w-full rounded-lg" />
    </main>
  );
}
