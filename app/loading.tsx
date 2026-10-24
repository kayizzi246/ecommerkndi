import { ProductGridSkeleton } from "@/components/Skeletons";

/**
 * Shown the instant a link is tapped, for every route without a loading screen
 * of its own.
 *
 * Without it, a page that has to ask WordPress for something kept the previous
 * page frozen on screen until the answer came back, and a shopper on a slow
 * connection could not tell a tap had registered — so they tapped again.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-[var(--shell)] px-3 pb-16 pt-4 md:px-8" aria-busy="true">
      <span className="sr-only" role="status">
        Loading…
      </span>
      <div className="route-progress" aria-hidden />
      <div className="shimmer mb-2 h-6 w-48 rounded" />
      <div className="shimmer mb-6 h-3.5 w-28 rounded" />
      <ProductGridSkeleton count={12} />
    </main>
  );
}
