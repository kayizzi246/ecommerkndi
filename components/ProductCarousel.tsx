"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";

/**
 * A horizontally scrolling row of PLP tiles — the "More from this store" rail
 * on the product page.
 *
 * Tiles snap, so a swipe always settles on a whole tile rather than half of
 * one, and the arrows page by whole tiles for the same reason. Each arrow only
 * shows when there is something in its direction, which also hides both when
 * the row fits without scrolling.
 */
export default function ProductCarousel({
  title,
  products,
}: {
  title: string;
  products: Product[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    // A pixel of slack: fractional widths can leave scrollLeft a hair short
    // of the true end, which would keep the next arrow up forever.
    setCanPrev(track.scrollLeft > 1);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  // Fires once on observe, then whenever the track's width changes.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateArrows]);

  if (products.length === 0) return null;

  const scrollByPage = (direction: 1 | -1) => {
    const track = trackRef.current;
    const tile = track?.firstElementChild as HTMLElement | null;
    if (!track || !tile) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = tile.offsetWidth + gap;
    // As many whole tiles as fit on screen, at least one.
    const tiles = Math.max(1, Math.floor((track.clientWidth + gap) / step));
    track.scrollBy({ left: direction * tiles * step, behavior: "smooth" });
  };

  const arrow =
    "absolute top-[38%] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-white text-shop-ink transition-colors hover:bg-shop-surface md:flex";

  return (
    <section className="relative mt-8">
      <h2 className="mb-4 text-[21px] font-extrabold text-shop-ink md:text-[23px]">{title}</h2>

      <div
        ref={trackRef}
        onScroll={updateArrows}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain no-scrollbar md:gap-3"
      >
        {/* Same 40% as the homepage rails, so a phone shows 2.5 tiles here too
            — the recommendation rail and the merchandising rails must not
            disagree about how big a product is. `sizes` mirrors the widths, so
            the browser asks for a file the tile can actually use. */}
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[43%] shrink-0 snap-start sm:w-[32%] md:w-[24%] lg:w-[19%]"
          >
            <ProductCard
              product={product}
              sizes="(max-width: 640px) 40vw,(max-width: 768px) 31vw, (max-width: 1024px) 23vw, 18vw"
            />
          </div>
        ))}
      </div>

      {canPrev && (
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Previous products"
          className={`${arrow} -left-3`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {canNext && (
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Next products"
          className={`${arrow} -right-3`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </section>
  );
}
