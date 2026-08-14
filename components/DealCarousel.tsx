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
  /**
   * Tailwind width classes for one item — controls how many are visible.
   *
   * 40% on a phone — 100/2.5 — so two and a half tiles sit in the viewport.
   * The half is the point: a rail showing a whole number of tiles looks like a
   * finished grid that happens to be one row tall, and a shopper has no reason
   * to swipe it. The tile sliced by the right edge is the affordance — it is
   * the only thing that says there is more this way.
   *
   * It showed 3.7 before, then 2.8. At 3.7 a product photograph on a 390px
   * screen was about 100px wide — a thumbnail of a product rather than a
   * product. At 2.5 it is ~150px, which is where the price, the struck-through
   * original and the discount are all legible without a second look, and that
   * is what a rail has to do in the second a thumb gives it.
   */
  itemWidth = "w-[40%] sm:w-[31%] md:w-[23.5%] lg:w-[18.5%] xl:w-[15.8%]",
  priority = false,
}: {
  products: Product[];
  /** Accepted and ignored — kept so existing call sites compile unchanged. */
  tone?: DealTone;
  itemWidth?: string;
  /**
   * Set on the one rail that is above the fold when the page opens — nothing
   * below it benefits, and marking more rails eager would slow the first paint
   * rather than speed it up.
   */
  priority?: boolean;
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
        className="flex snap-x snap-mandatory gap-px overflow-x-auto scroll-smooth pb-1 no-scrollbar"
      >
        {products.map((product, index) => (
          <div key={product.id} className={`shrink-0 snap-start ${itemWidth}`}>
            {/* Only the two tiles a phone can actually see are eager. Beyond
                that they would compete with each other for bandwidth and the
                first paint would arrive later, not sooner. */}
            {/* `sizes` mirrors `itemWidth` above. The two have to be changed
                together: `itemWidth` is what the tile measures and `sizes` is
                what we tell the browser it measures, and when they disagree
                the browser silently downloads the wrong file. */}
            <ProductCard
              product={product}
              priority={priority && index < 2}
              sizes="(max-width: 640px) 40vw,(max-width: 768px) 31vw, (max-width: 1024px) 23.5vw, (max-width: 1280px) 18.5vw, 16vw"
            />
          </div>
        ))}
      </div>

      {/* The edge fades are gone.
          They were two gradient overlays, 48px and 64px wide, sitting on top of
          the tiles at each end of the track. The intent was to make the cut
          tile read as continuing off-screen — but a gradient over a photograph
          washes the photograph out, and what it actually produced was a pale
          glow smeared down both edges of every rail on the homepage. With the
          rail now showing 3.7 tiles the cut itself does that job honestly: a
          tile visibly sliced by the viewport edge says "more this way" without
          bleaching the product next to it. */}

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
