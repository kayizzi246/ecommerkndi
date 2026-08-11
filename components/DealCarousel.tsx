"use client";

import { useCallback, useRef, useState } from "react";
import type { Product } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";

/** Kept in the signature so existing call sites compile unchanged. */
export type DealTone = "orange" | "red" | "green" | "blue" | "violet";

/**
 * Horizontal product rail with snap scrolling and edge arrows.
 *
 * Renders the same {@link ProductCard} as every grid on the site. It used to
 * render a bare-bones tile of its own, which meant the identical product looked
 * like two different things depending on whether it landed in a rail or a grid
 * — and the rail version quietly dropped the rating, the units sold and the
 * add-to-cart button, which are the three things that sell it.
 *
 * Arrows only appear once there is somewhere to scroll, and each disables at
 * its end of the track, so the control never lies about what it will do. The
 * track itself stays a plain scroll container, which keeps touch and trackpad
 * swiping native on mobile.
 */
export default function DealCarousel({
  products,
  /** Tailwind width classes for one item — controls how many are visible. */
  itemWidth = "w-[47.5%] sm:w-[30%] md:w-[23%] lg:w-[18%] xl:w-[15.5%]",
  /** Background the edge fades into; match the rail's own surface. */
  fadeFrom = "from-white",
}: {
  products: Product[];
  /** Accepted and ignored — kept so existing call sites compile unchanged. */
  tone?: DealTone;
  itemWidth?: string;
  fadeFrom?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setScrollable(max > 4);
    setAtStart(track.scrollLeft <= 4);
    setAtEnd(track.scrollLeft >= max - 4);
  }, []);

  // Measured as the track mounts, then kept in sync by the scroll handler and
  // a resize observer — no effect needed.
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      trackRef.current = node;
      if (!node) return;
      sync();
      const observer = new ResizeObserver(sync);
      observer.observe(node);
      return () => observer.disconnect();
    },
    [sync]
  );

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={attach}
        onScroll={sync}
        className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth pb-1 no-scrollbar sm:gap-2"
      >
        {products.map((product) => (
          <div key={product.id} className={`shrink-0 snap-start ${itemWidth}`}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {/* Edge fades. The tile at the cut is meant to peek — without these it
          just looks chopped off, and with them it reads as "more this way". */}
      {scrollable && !atStart && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r ${fadeFrom} to-transparent`}
        />
      )}
      {scrollable && !atEnd && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l ${fadeFrom} to-transparent`}
        />
      )}

      {scrollable && (
        <>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={atStart}
            aria-label="Scroll left"
            className="absolute left-1 top-1/3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-white/95 text-shop-ink shadow-lg backdrop-blur transition hover:bg-white hover:text-shop-primary disabled:pointer-events-none disabled:opacity-0 md:flex"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={atEnd}
            aria-label="Scroll right"
            className="absolute right-1 top-1/3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-white/95 text-shop-ink shadow-lg backdrop-blur transition hover:bg-white hover:text-shop-primary disabled:pointer-events-none disabled:opacity-0 md:flex"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
