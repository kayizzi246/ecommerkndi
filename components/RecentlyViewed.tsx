"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { formatPrice } from "@/lib/currency";
import SectionHeader from "@/components/home/SectionHeader";

/**
 * The rail of what this visitor has already looked at.
 *
 * ---- It used to be a different object from every other rail ----
 *
 * This drew 112px tiles — `w-28`, a fixed width at every breakpoint — with the
 * price above the name, a bordered white frame around each photograph, and no
 * arrows. Every other rail on the shop is a {@link DealCarousel}: a snapping
 * track on a fractional width ramp, borderless tiles on a `bg-shop-hairline`
 * frame, name above price, and edge arrows that appear only when there is
 * somewhere to scroll.
 *
 * So the same product looked like two different things depending on which strip
 * it landed in — and on the homepage the two sit within a screen of each other.
 * A 112px tile beside a 215px one also reads as the lesser rail, which is
 * backwards: these are the products this shopper personally chose to look at,
 * the highest-intent strip on the page.
 *
 * ---- Why it is not simply a DealCarousel ----
 *
 * `DealCarousel` renders {@link ProductCard}, and a ProductCard needs a whole
 * `Product` — rating, review count, total sales, stock state, attributes,
 * gallery. What localStorage holds is five fields: id, name, image, price,
 * slug. That is all it has ever held, and deliberately so; the alternative is
 * a shopper's browser carrying a copy of a dozen full product records that go
 * stale the moment a price changes.
 *
 * Given those five fields there are two honest options and one dishonest one.
 * The dishonest one is to build a stub Product and let ProductCard render it,
 * which prints an empty star row, "0 sold", and an Add to cart button with no
 * variation data behind it — a tile that states things about the product that
 * are not true. The other option is to hydrate the ids from the API on every
 * page this appears on, which is a network round-trip and twelve product reads
 * for a strip that is nobody's reason for being here.
 *
 * So the rail borrows the carousel's SHAPE and shows only what it knows. The
 * width ramp, the gap ramp, the snap track, the arrows, the frame, and the
 * name-then-price block are all copied from `DealCarousel` and `ProductCard`
 * exactly, so a tile here is the same size and the same object as a tile there.
 * What is missing is missing visibly — there is no rating row drawn empty and
 * no chip slot standing blank — because a tile that is honestly shorter reads
 * as a smaller card, while a tile padded with zeroes reads as a broken one.
 *
 * If this should ever carry the full card, the change is an `include=` on
 * `/api/products` and a fetch here; the tile below then becomes a ProductCard
 * and everything else in this file stays as it is.
 *
 * `className` exists because the two places it renders space themselves
 * differently: the product page stacks sections with margins, so it keeps the
 * `mt-12` default, while the homepage lays its sections out in a flex column
 * with a gap — where a margin on top of the gap is a double helping of it.
 */
export default function RecentlyViewed({ className = "mt-12" }: { className?: string }) {
  const { items } = useRecentlyViewed();

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

  // Measured as the track mounts, then kept in sync by the scroll handler and a
  // resize observer — the same callback-ref pattern `DealCarousel` uses, and
  // for the same reason: no effect, and it re-measures when the rail is still
  // mounted but the window is not the size it was.
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

  // Nothing is drawn for a first-time visitor, which is what makes this safe to
  // place high on the homepage: it costs a new shopper no space at all, and a
  // returning one gets the thing they were last looking at above the fold.
  if (items.length === 0) return null;

  return (
    <section className={`shop-panel ${className}`}>
      {/* The shop's one section heading, rather than the hand-rolled `h2` that
          used to sit here at 20/24 with a plain count beside it. That heading
          was a fifth treatment on a page whose whole argument for a shared
          component is that four was already too many — see `SectionHeader`.

          The count rides in as the header's `children` slot, which is where the
          countdown and the badges on the other sections go. */}
      <SectionHeader title="Recently viewed">
        <span className="rounded-full bg-shop-hairline px-2.5 py-1 text-[12px] font-semibold text-shop-body">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </SectionHeader>

      <div className="relative">
        <div
          ref={attach}
          onScroll={sync}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 no-scrollbar sm:gap-4"
        >
          {items.map((item) => (
            // The ramp, the `min-w-0` and the snap alignment are `DealCarousel`'s
            // verbatim. They are copied rather than imported because they are a
            // string of Tailwind classes, and the two rails have to agree on
            // tile width at every breakpoint or the homepage shows two different
            // grids one above the other. If that string changes there, it
            // changes here.
            //
            // `min-w-0` matters as much here as it does there: a flex item's
            // default `min-width: auto` resolves to min-content, the price row
            // below is `whitespace-nowrap`, and min-width beats width — so
            // without this the declared width is a suggestion the phone ignores.
            <div
              key={item.productId}
              className="min-w-0 shrink-0 snap-start w-[calc((100vw-40px)/2.3)] sm:w-[34.5%] md:w-[23%] lg:w-[19%] xl:w-[15%] 2xl:w-[calc((100%-112px)/7.5)]"
            >
              <Link href={`/products/${item.productId}`} className="group block">
                {/* ---- The image, when there is one ----
                     A product with no photograph stores `image: ""` in the
                     recently-viewed list, and an empty string is the one value
                     `next/image` refuses: it throws `Image is missing required
                     "src" property`, and the browser treats `src=""` as a
                     request for the current page — so an imageless product in
                     this rail downloaded the whole page again for every tile.

                     The guard is on the value rather than a fallback `src`,
                     because there is no image to fall back to; the tile draws
                     the same empty frame the product card uses so the rail
                     keeps its shape.

                     The frame itself is now `ProductCard`'s: `rounded-lg` on
                     `bg-shop-hairline`, no border. The old white-on-white box
                     with a hairline round it was the single most visible reason
                     this rail read as foreign — every other tile on the shop
                     separates from its neighbour by the track gap alone. */}
                {/* Ratio and radius copied from `ProductCard`, which went to a
                    true square with a 12px corner. This rail sits directly
                    above the grid on the same page, so a tile here at a
                    different shape reads as a different kind of product. */}
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-shop-hairline">
                  {item.image ? (
                    <Image
                      quality={90}
                      src={item.image}
                      alt={item.name}
                      fill
                      // Mirrors the width ramp above, exactly as `DealCarousel`
                      // mirrors its own. When the two disagree the browser
                      // silently downloads the wrong file — and it was badly
                      // wrong before: a flat `112px` was being served to a tile
                      // that is 215px on a desktop, so every photograph in this
                      // rail arrived soft on the screens with the most room.
                      sizes="(max-width: 640px) 41vw, (max-width: 768px) 34.5vw, (max-width: 1024px) 23vw, (max-width: 1280px) 19vw, (max-width: 1536px) 15vw, (max-width: 1720px) 13vw, 215px"
                      className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-shop-muted">
                      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                        <rect x="3" y="5" width="18" height="14" rx="1" />
                        <circle cx="8.5" cy="10" r="1.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 3-2 4 3" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* ---- Name above price, which is the way round the shop reads ----

                     This rail had them inverted — price first, then the name in
                     a two-line clamp under it. Every other tile on the site puts
                     the name first and lets the price be the line the eye lands
                     on last and hardest, and the hierarchy is carried by weight
                     and size rather than by order: `.product-name` is 400,
                     `.price` is 700.

                     `truncate` rather than the old `line-clamp-2`, again
                     matching `ProductCard`: one line means every tile in the row
                     is the same height, which is the whole reason that card
                     fixes its text rows. */}
                <h3 className="product-name mt-2 truncate text-[12px] leading-[17px] text-shop-ink transition-colors group-hover:text-shop-primary">
                  {item.name}
                </h3>
                <p className="price mt-1 whitespace-nowrap">{formatPrice(item.price)}</p>
              </Link>
            </div>
          ))}
        </div>

        {/* The same arrows as every other rail: only drawn once there is
            somewhere to scroll, each disabled at its own end of the track, and
            hidden below `md` where the swipe is native. */}
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
    </section>
  );
}
