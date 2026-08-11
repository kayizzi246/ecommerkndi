"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";

/**
 * The endless grid that closes the homepage.
 *
 * The first page arrives rendered from the server, so the grid is full on
 * arrival and search engines index real products rather than an empty div. Each
 * further page loads when the sentinel at the foot scrolls into view.
 *
 * An IntersectionObserver rather than a scroll handler: the browser reports when
 * the sentinel is visible instead of us asking on every frame, which is cheaper
 * and stays correct through resizes and back-navigation restores.
 *
 * The "Load more" button is not a fallback for the observer — it is the
 * accessible path, because an infinite list with no control is unreachable for
 * anyone driving the page from the keyboard.
 */
export default function InfiniteProducts({
  initialProducts,
  totalPages,
}: {
  initialProducts: Product[];
  totalPages: number;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const done = page >= totalPages;

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);
    setFailed(false);

    try {
      const next = page + 1;
      const response = await fetch(`/api/products?page=${next}&per_page=24`);
      if (!response.ok) throw new Error(String(response.status));

      const payload = (await response.json()) as { products: Product[] };

      setProducts((current) => {
        // WooCommerce can repeat a product across pages when the catalogue is
        // edited mid-scroll; React would then throw on the duplicate key.
        const seen = new Set(current.map((product) => product.id));
        return [...current, ...payload.products.filter((p) => !seen.has(p.id))];
      });
      setPage(next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, page]);

  useEffect(() => {
    const node = sentinel.current;
    // Nothing left to fetch, or a failure the shopper should retry by hand
    // rather than have us hammer the endpoint automatically.
    if (!node || done || failed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      // Start a screen early, so the next row is usually there by the time the
      // shopper reaches it.
      { rootMargin: "600px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, done, failed]);

  if (products.length === 0) return null;

  return (
    <>
      {/* Six across on a desktop, stepping down to two on a phone. At the
          1600px shell six columns leave each photograph around 255px, which is
          comfortably above the size a fashion tile stops reading at, and the
          extra column puts a third more stock on the first screen. Gaps are
          tight on purpose, and tighter still on a phone: a dense grid reads as
          a catalogue with depth, and 6px between two columns is all it takes to
          tell them apart on a 390px screen. */}
      {/* 1px in both directions on a phone. Cards carry their own white
          background, so the hairline reads as a grid line rather than a gap,
          and every pixel saved goes into the photograph — which is the thing
          that actually sells. Vertical breathing room returns at sm. */}
      <ul className="grid grid-cols-2 gap-px sm:gap-y-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      <div ref={sentinel} className="mt-10 flex justify-center">
        {loading && (
          <p className="text-[14px] text-shop-muted" role="status">
            Loading more…
          </p>
        )}

        {failed && (
          <button
            type="button"
            onClick={loadMore}
            className="rounded-lg border border-shop-line px-6 py-2.5 text-[14px] text-shop-ink transition-colors hover:border-shop-primary hover:text-shop-primary"
          >
            Could not load more — try again
          </button>
        )}

        {!loading && !failed && !done && (
          <button
            type="button"
            onClick={loadMore}
            className="rounded-lg border border-shop-line px-8 py-2.5 text-[14px] text-shop-ink transition-colors hover:border-shop-primary hover:text-shop-primary"
          >
            Load more
          </button>
        )}

        {done && (
          <p className="text-[13px] text-shop-muted">You have seen everything in the shop.</p>
        )}
      </div>
    </>
  );
}
