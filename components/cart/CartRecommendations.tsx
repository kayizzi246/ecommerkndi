"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";

/** How many the row asks for, and the most it will ever draw. */
const SHOWN = 8;

/**
 * "You may also like", under the cart lines.
 *
 * Fetched in the browser rather than passed down from the server: the cart page
 * is a client component, and this is below-the-fold content on a page no search
 * engine indexes — so there is nothing to gain from rendering it up front, and
 * one request saved on every other page that does not need it.
 *
 * `excludeIds` is what is already in the basket. Recommending someone the thing
 * they have just added reads as broken, and it is the one row of products that
 * cannot possibly increase the order.
 *
 * ---- Why this is not the homepage grid ----
 *
 * It used to be, copied class for class: six columns at xl, five at lg. That
 * grid is written for the full width of the window, and this row is not in the
 * full width of the window — it sits in the left column of the cart, beside a
 * 364px order summary. Five columns inside roughly 700px is a 110px tile, which
 * is narrower than the tile is designed to go: the name truncates to two words,
 * the price and the "only 1 left" line collide, and the picture is too small to
 * be the reason anyone clicks.
 *
 * So the count is set from the column this actually lives in — four across at
 * the widest — and on a phone the row stops being a grid at all and becomes a
 * rail. Two-and-a-bit tiles at a readable size, swiped, is how every other
 * recommendation row in this shop behaves; a 2×4 grid of tiny squares at the
 * bottom of a cart is how none of them do.
 */
export default function CartRecommendations({ excludeIds }: { excludeIds: number[] }) {
  const [products, setProducts] = useState<Product[]>([]);
  const trackRef = useRef<HTMLUListElement>(null);

  // The cart's contents are the input, but only as a list of ids to leave out —
  // so the dependency is the joined string, not the array, which would be a new
  // reference on every render and refetch forever.
  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    // Abandoned if the shopper leaves before it lands, so a late response can
    // never call setState on an unmounted component.
    const controller = new AbortController();

    (async () => {
      try {
        // A wider page than the row needs: after removing what is already in
        // the basket there must still be enough left to fill it.
        const response = await fetch("/api/products?page=1&per_page=20", {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as { products: Product[] };
        const excluded = new Set(excludeKey ? excludeKey.split(",").map(Number) : []);

        setProducts(payload.products.filter((p) => !excluded.has(p.id)).slice(0, SHOWN));
      } catch {
        // A failed suggestion row is not worth an error message — the cart
        // itself is unaffected, so the section simply stays hidden.
      }
    })();

    return () => controller.abort();
  }, [excludeKey]);

  // Nothing to show, or a catalogue too small to have anything left over once
  // the basket is excluded. Rendering an empty heading would look like a bug.
  if (products.length === 0) return null;

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="mt-10 border-t border-shop-line pt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-title text-[18px] text-shop-ink">You may also like</h2>

        {/* Arrows on the desktop grid would point at nothing, so they belong to
            the rail — and the rail only exists below md. */}
        {products.length > 2 && (
          <div className="flex gap-1.5 md:hidden">
            {([-1, 1] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => scrollBy(direction)}
                aria-label={direction === -1 ? "Previous products" : "Next products"}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-shop-line bg-white text-shop-ink active:bg-shop-surface"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={direction === -1 ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
                  />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---- One element, two layouts ----
          Below md it is a snapping rail: `flex` with fixed-width children that
          refuse to shrink. From md it is a grid and those widths are dropped, so
          nothing has to be duplicated or hidden — and there is only ever one
          copy of each tile in the DOM, which matters because a ProductCard
          carries state (variant sheet, add-to-cart) that must not exist twice.

          `-mx-4 px-4` lets the rail bleed to the edges of a phone screen while
          the first tile still lines up with the cart lines above it; it is
          cancelled from md, where the grid sits inside the column proper. */}
      <ul
        ref={trackRef}
        className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-4 no-scrollbar md:mx-0 md:grid md:grid-cols-3 md:gap-x-3 md:gap-y-5 md:overflow-visible md:px-0 lg:grid-cols-4"
      >
        {products.map((product) => (
          <li
            key={product.id}
            /* ---- Measured from the viewport, not from the parent ----

               A percentage here is a percentage of the flex track, and the
               track is inside a bled, padded column inside the cart's grid —
               so what 38% resolved to depended on three ancestors agreeing.
               It did not survive the trip: the tiles came out near
               full-width, which pushed the product name past the edge of the
               screen and made the row look like one product with a sliver of
               a second.

               `100vw` cannot be got wrong by an ancestor. The 52px is the
               page's own gutter (16px each side) plus the two 10px gaps that
               sit between two and a half tiles, so the arithmetic states the
               thing being asked for: two and a half cards, edge to edge.

               Above sm the percentage is fine again, because by then the
               column is a known width and the rail becomes a grid at md. */
            className="w-[calc((100vw-52px)/2.5)] shrink-0 snap-start sm:w-[31%] md:w-auto md:shrink"
          >
            <ProductCard
              product={product}
              sizes="(max-width: 640px) 40vw, (max-width: 768px) 31vw, (max-width: 1280px) 22vw, 200px"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
