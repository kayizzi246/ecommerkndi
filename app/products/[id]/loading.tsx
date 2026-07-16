import { ProductGridSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-5">
      <div className="shimmer h-4 w-72 rounded mb-8" />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Gallery skeleton */}
        <div className="flex gap-4">
          <div className="hidden md:flex flex-col gap-3 shrink-0">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="shimmer w-20 h-20" />
            ))}
          </div>
          <div className="shimmer flex-1 aspect-square" />
        </div>

        {/* Details skeleton */}
        <div className="space-y-4">
          <div className="shimmer h-7 w-40 rounded" />
          <div className="shimmer h-5 w-4/5 rounded" />
          <div className="shimmer h-9 w-44 rounded" />
          <div className="shimmer h-4 w-32 rounded" />
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="shimmer w-14 h-11" />
            ))}
          </div>
          <div className="shimmer h-14 w-full rounded pt-2" />
          <div className="shimmer h-24 w-full rounded" />
        </div>
      </div>

      <div className="mt-14">
        <div className="shimmer h-6 w-48 rounded mb-6" />
        <ProductGridSkeleton count={4} />
      </div>
    </main>
  );
}
