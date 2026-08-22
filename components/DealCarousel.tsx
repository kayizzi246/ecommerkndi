"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
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
   * It showed 3.7 before, then 2.8, then 2.5. At 3.7 a product photograph on a
   * 390px screen was about 100px wide — a thumbnail of a product rather than a
   * product.
   *
   * 2.2 now (`44%`), because 2.5 was still not enough. A 150px tile could not
   * fit "UGX 120,000" beside a struck-through original without the row
   * overflowing, and the half-tile hanging off the right edge was cut through
   * the middle of its price rather than through its photograph — which reads as
   * a broken layout rather than as an invitation to swipe.
   *
   * 49% now, and every width above it went up by the same step. The tiles were
   * asked to show the goods bigger, and a rail tile has only one lever for that
   * — a photograph here is exactly as wide as its column. The peek survives the
   * change: at 49% the third tile is still sliced across its image, though
   * this is the ceiling — at 50% two tiles fill the viewport exactly and the
   * peek that makes the rail look swipeable disappears.
   *
   * ---- 2xl shows eight ----
   *
   * The top step is the one width here that is not a plain percentage, because
   * six is a count rather than a proportion and the gaps stop being a rounding
   * error at that density. Six tiles have six 16px gaps between them and the
   * peek — `sm:gap-4` on the track — which is 96px of a 1436px shell, most of
   * a seventh tile, and a percentage that ignores it lands a tile short.
   *
   * 6.5, not 6: the divisor carries the peek that every other step here
   * carries. Six tiles sit clear of the right edge and the seventh is sliced
   * down its photograph, so a rail on a large monitor still says there is more
   * this way rather than reading as a finished row.
   *
   * Six rather than the eight this step used to hold, because `--shell` is
   * bounded rather than 100%: eight columns of a 1436px shell is a 172px tile,
   * smaller than this shop's phone tile. The rail and the grid have to agree
   * on any given screen, so this follows the grid to six.
   *
   * ---- Where the ramp landed: 2 → 3 → 4 → 6 → 7 ----
   *
   * `md` dropped to four so the tablet gets a bigger picture; `2xl` went to
   * seven because seven across is what was asked for. Both are `InfiniteProducts`
   * being mirrored, which is the only rule this line has ever followed — see
   * the ramp note there for why each step is where it is.
   *
   * These are percentages of the TRACK, so they never cared that `--shell`
   * went to 100% and back to 1720. The `sizes` string below did, and is a
   * fixed 215px again: above 1720 the track stops growing, so the tile is the
   * same size on every window wider than that.
   *
   * ---- The middle of the ramp was rebuilt around the tablet step ----
   *
   * It used to read `md:27% lg:21.5% xl:18.5%`, which is 3.7, 4.6 and 5.4
   * tiles — a rail that shows three-and-a-bit products on an iPad while the
   * grid directly below it shows five. The two are the same products in the
   * same card at the same moment on the same screen, and they disagreed.
   *
   * The counts now mirror `InfiniteProducts` exactly: 2 → 3 → 4 → 6 → 7.
   *
   *   md   23%    four, from 768px — the tablet step
   *   xl   15%    six, from 1280px
   *   2xl  /7.5   seven, from 1536px, where a % starts drifting on the gaps
   *
   * `lg` is deliberately absent. A rail at `lg` would have to show either four
   * (what `md` already sets) or six (what `xl` sets), and a step that repeats
   * its neighbour is not a step. Between 1024 and 1280 the four tiles simply
   * get wider, which is the one range where that is the right answer — the
   * grid does exactly the same thing there.
   *
   * ---- Every percentage still carries the peek ----
   *
   * None of these divide evenly into 100. That is the point: the remainder is
   * the sliced tile at the right edge that tells a shopper the rail scrolls.
   * At 17.5% on an 820px iPad, five tiles and four 16px gaps come to about
   * 24px short of the track, so the sixth is cut down its photograph rather
   * than through its price — which is the distinction the phone note above
   * spent three paragraphs on.
   *
   * The `sizes` string on the ProductCard below mirrors these numbers and has to
   * be changed with them, or the browser downloads the wrong file.
   */
  itemWidth = "w-[49%] sm:w-[34.5%] md:w-[23%] xl:w-[15%] 2xl:w-[calc((100%-112px)/7.5)]",
  priority = false,
  viewAll,
}: {
  products: Product[];
  /**
   * A tile at the end of the track linking on to the full list.
   *
   * The alternative — and what this replaced — is a "View All" link in the
   * section heading. That link is read at the moment a shopper has seen none of
   * the products and has no reason to want more of them; here it arrives at the
   * one moment they demonstrably do, having swiped past everything in the rail.
   * It also gives the track a proper end, so the last swipe lands on something
   * rather than a half tile against the edge.
   */
  viewAll?: { href: string; label: string };
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
        // 10px between tiles, 16px from sm — matching the column gap in
        // `InfiniteProducts`, which is where the reasoning is written out.
        //
        // The short version: `ProductCard` is borderless, so the gap is the
        // only thing separating one product from the next. At the old 8px a
        // rail read as one long photograph strip and the snap points landed
        // with no visible seam to explain them.
        //
        // The gap does not change what `itemWidth` measures, so the `sizes`
        // attribute below stays accurate — those two only have to move together
        // when the tile WIDTH does.
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth pb-1 no-scrollbar sm:gap-4"
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
              sizes="(max-width: 640px) 49vw, (max-width: 768px) 34.5vw, (max-width: 1280px) 23vw, (max-width: 1536px) 15vw, (max-width: 1720px) 13vw, 215px"
            />
          </div>
        ))}

        {viewAll && (
          <div className={`shrink-0 snap-start ${itemWidth}`}>
            {/* Sized to the tile beside it and shaped like the photograph, so
                the row keeps its rhythm — a link floating at half height would
                read as the rail having broken rather than ended. */}
            <Link
              href={viewAll.href}
              className="group/all flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[3px] border border-dashed border-shop-line bg-white px-2 text-center transition-colors hover:border-shop-primary"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-shop-primary-soft text-shop-primary transition-transform group-hover/all:translate-x-0.5">
                <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                </svg>
              </span>
              <span className="text-[13px] font-bold leading-tight text-shop-ink">
                {viewAll.label}
              </span>
            </Link>
          </div>
        )}
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
            className="absolute left-1 top-1/3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-white/95 text-shop-ink backdrop-blur transition hover:bg-white hover:text-shop-primary disabled:pointer-events-none disabled:opacity-0 md:flex"
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
            className="absolute right-1 top-1/3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-shop-line bg-white/95 text-shop-ink backdrop-blur transition hover:bg-white hover:text-shop-primary disabled:pointer-events-none disabled:opacity-0 md:flex"
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
