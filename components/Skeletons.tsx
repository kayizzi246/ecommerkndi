export function ProductCardSkeleton() {
  return (
    <div>
      {/* Matches ProductCard: a square frame with the label plate inside it. */}
      <div className="shimmer aspect-square w-full rounded-lg" />
    </div>
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
