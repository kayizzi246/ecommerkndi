"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

export type Promotion = {
  badge: string;
  headline: string;
  note: string;
  url: string;
};

/**
 * The campaign rail: what the shop is running right now.
 *
 * A scrolling row of cards rather than a grid, because campaigns come and go in
 * different numbers — two in February, five before Christmas — and a grid built
 * for four looks broken at three. The row simply gets longer.
 *
 * Each card is a flat colour block with a badge, a headline and one supporting
 * line. No photographs: a campaign is a claim about prices, and a picture of one
 * product misrepresents a sale that covers a hundred. The colours cycle through
 * a fixed sequence so no two neighbours match, and they are the shop's own
 * palette rather than per-campaign choices — a settings screen that let anyone
 * pick a colour would eventually produce a lime green Christmas.
 */

/** The rotation. Deep enough that six cards never repeat a neighbour. */
const TONES = [
  "from-shop-primary to-shop-ember",
  "from-pop-red to-[#b91c1c]",
  "from-shop-ink to-[#3f3f46]",
  "from-pop-green to-[#15803d]",
  "from-pop-violet to-[#4c1d95]",
  "from-pop-blue to-[#1e3a8a]",
];

export default function PromotionsRail({ promotions }: { promotions: Promotion[] }) {
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

  // Measured as the track mounts, then kept current by the scroll handler and a
  // resize observer — the same approach as the product carousels.
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
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  };

  if (promotions.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={attach}
        onScroll={sync}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 no-scrollbar"
      >
        {promotions.map((promo, index) => (
          <Link
            key={`${promo.headline}-${index}`}
            href={promo.url}
            className={`group relative flex min-h-[132px] w-[78%] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white transition-transform duration-150 hover:-translate-y-0.5 sm:w-[46%] lg:w-[31%] xl:w-[23.5%] ${
              TONES[index % TONES.length]
            }`}
          >
            {/* A soft light in the corner, so a flat colour block has some
                depth without costing an image request. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl"
            />

            <div className="relative">
              {promo.badge && (
                <span className="inline-block rounded-full bg-black/25 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.1em]">
                  {promo.badge}
                </span>
              )}
              <p className="font-heading mt-2.5 text-[20px] leading-tight">{promo.headline}</p>
              {promo.note && (
                <p className="mt-1 text-[13.5px] leading-snug text-white/85">{promo.note}</p>
              )}
            </div>

            <span className="relative mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold">
              Shop now
              <svg
                aria-hidden
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      {scrollable && (
        <>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={atStart}
            aria-label="Previous promotions"
            className="absolute left-1 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-white/95 text-shop-ink shadow-lg backdrop-blur transition hover:text-shop-primary disabled:pointer-events-none disabled:opacity-0 md:flex"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={atEnd}
            aria-label="More promotions"
            className="absolute right-1 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-white/95 text-shop-ink shadow-lg backdrop-blur transition hover:text-shop-primary disabled:pointer-events-none disabled:opacity-0 md:flex"
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
