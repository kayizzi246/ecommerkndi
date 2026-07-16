export function ProductCardSkeleton() {
  return (
    <div>
      <div className="shimmer aspect-square w-full" />
      <div className="pt-3 space-y-2">
        <div className="shimmer h-3 w-1/3 rounded" />
        <div className="shimmer h-4 w-1/2 rounded" />
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-5 w-2/5 rounded" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
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
