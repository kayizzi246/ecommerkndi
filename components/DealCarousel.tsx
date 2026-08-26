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
   * 49% then, and every width above it went up by the same step. The tiles were
   * asked to show the goods bigger, and a rail tile has only one lever for that
   * — a photograph here is exactly as wide as its column.
   *
   * ---- 2.3 on a phone, and why it is a calc rather than a percentage ----
   *
   * 49% was the ceiling of that approach and it sat right against it: two tiles
   * and a sliver. Counting the 10px gaps, 49% of a 366px track is 179px a tile,
   * so the third tile got 8px of the viewport — a seam rather than a peek, and
   * at a glance indistinguishable from a two-column grid.
   *
   * 2.3 is the count now, and a plain percentage cannot express it. `100/2.3`
   * is 43.5%, which ignores the two 8px gaps standing between the three tiles
   * and lands at about 2.18 visible — the same drift the `2xl` step below has
   * always carried, for the same reason. So the gaps come out of the width
   * first, exactly as they do there:
   *
   *   w = (track - 2 gaps) / 2.3
   *
   * Two whole tiles, then 30% of a third, sliced down its photograph rather
   * than through its price. The peek is the whole point of a fractional count —
   * a rail showing a whole number of tiles reads as a finished grid nobody
   * swipes — and 0.3 of a tile is still unmistakably a sliced photograph rather
   * than the 8px seam 49% produced.
   *
   * ---- ...and why the phone step is `vw` rather than `%` ----
   *
   * A percentage resolves against the TRACK, and the track is only as wide as
   * its parent chooses to make it. Drop this rail into a container that sizes
   * itself to its contents — a grid `auto` column, say — and the track becomes
   * as wide as every tile laid end to end, roughly 1630px, at which point
   * "38.5% of the track" is a 620px tile and the phone shows one product. That
   * is not hypothetical; it is what the old TwinDeals panel did before it was
   * deleted, and the percentage
   * looked correct in the source the whole time it was happening.
   *
   * `vw` has no such dependency. Below `sm` this rail always spans the page
   * column, which is the viewport less the `px-3` gutter, so the width can be
   * stated absolutely and no ancestor can distort it:
   *
   *   w = (100vw - 24px gutter - 16px gaps) / 2.3
   *
   * On a 408px phone that is a 160px tile: 2.3 of them plus two gaps is exactly
   * the 384px column. Both pages that render a rail on a phone — the homepage
   * and /categories — use `px-3`, so the 24px holds for each.
   *
   * The steps above `sm` stay percentages. From there up the containers are
   * definite (`md:grid-cols-2`, flex columns) and a percentage is the more
   * honest unit, because it tracks a panel that is no longer the full page.
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
   * The counts mirror `InfiniteProducts`: 2 → 3 → 4 → 6, and then they part.
   *
   *   md   23%    four, from 768px — the tablet step
   *   xl   15%    six, from 1280px
   *   2xl  /7.5   SEVEN, from 1536px, where the grid holds six
   *
   * ---- The top step diverges on purpose, which the rest of this note argues
   * against ----
   *
   * Everything above says a rail and the grid under it must not disagree, and
   * that is still the rule for every step but the last one. At 2xl they now
   * differ by one tile, and it was asked for after seeing both.
   *
   * It is defensible, which is why it is written down rather than resisted. A
   * rail and a grid are answering different questions: the grid is the
   * catalogue, where the tile is the unit of judgement and 266px of photograph
   * is worth having, while a rail is a shelf you skim — its job is to show
   * that there is MORE, and a seventh tile plus the sliced peek says so more
   * plainly than a sixth does. The two shapes sit far enough apart on the page
   * that a 206px rail tile above a 266px grid tile reads as two kinds of
   * object rather than as one object at two sizes.
   *
   * What would NOT be defensible is drifting further. Two counts apart and the
   * rail stops looking like a shelf of the same shop.
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
  itemWidth = "w-[calc((100vw-40px)/2.3)] sm:w-[34.5%] md:w-[23%] lg:w-[19%] xl:w-[15%] 2xl:w-[calc((100%-112px)/7.5)]",
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
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 no-scrollbar sm:gap-4"
      >
        {products.map((product, index) => (
          // ---- `min-w-0`, or `itemWidth` is a suggestion ----
          //
          // A flex item defaults to `min-width: auto`, which resolves to its
          // MIN-CONTENT width — and min-width beats width. `ProductCard` puts
          // `whitespace-nowrap` on the price and `shrink-0` on the meta chips,
          // so its min-content floor is a good deal wider than a phone tile.
          // Below that floor the item quietly ignores every width on this
          // track and renders at its content size: one card filling the
          // screen, no matter what the ramp above says.
          //
          // This was invisible while the phone step was 49% (~179px), which sat
          // above the floor. Asking for 2.6 tiles (~133px) put the request
          // under it and the rail collapsed to a single product.
          //
          // `min-w-0` lifts the floor and lets the declared width win. Nothing
          // spills: the card's text rows already clip and truncate on their
          // own — see the `overflow-hidden` on the price row and the title's
          // `truncate` in `ProductCard`.
          <div key={product.id} className={`min-w-0 shrink-0 snap-start ${itemWidth}`}>
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
              // The phone step is 41vw rather than the 43.5vw that `100/2.3`
              // suggests, because the real tile is that fraction of a column
              // narrower than the viewport by the gutter and two gaps — about
              // 38.6vw at 390px, 40.5vw at 640px. Declared a little over the
              // measurement on purpose: under-declaring picks the next srcset
              // step down and the photograph arrives soft.
              sizes="(max-width: 640px) 41vw, (max-width: 768px) 34.5vw, (max-width: 1024px) 23vw, (max-width: 1280px) 19vw, (max-width: 1536px) 15vw, (max-width: 1720px) 13vw, 210px"
            />
          </div>
        ))}

        {viewAll && (
          // Same `min-w-0` as the product tiles above, for the same reason —
          // this tile has to measure exactly as wide as they do or the rail
          // ends on a step.
          <div className={`min-w-0 shrink-0 snap-start ${itemWidth}`}>
            {/* Sized to the tile beside it and shaped like the photograph, so
                the row keeps its rhythm — a link floating at half height would
                read as the rail having broken rather than ended. */}
            <Link
              href={viewAll.href}
              className="group/all flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-shop-line bg-white px-2 text-center transition-colors hover:border-shop-primary"
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
