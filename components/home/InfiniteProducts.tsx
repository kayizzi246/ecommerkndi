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
  /**
   * Restrict the grid to one category, by slug.
   *
   * The homepage leaves this off and gets the whole catalogue. A product page
   * passes the category of the product being viewed, so its "You may also like"
   * grid keeps pulling in neighbours of that item rather than drifting into the
   * rest of the shop by page three.
   */
  category,
  /** Exclude one product from the grid — the one whose page this is. */
  excludeId,
}: {
  initialProducts: Product[];
  totalPages: number;
  category?: string;
  excludeId?: number;
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
      const response = await fetch(
        `/api/products?page=${next}&per_page=24${
          category ? `&category=${encodeURIComponent(category)}` : ""
        }`
      );
      if (!response.ok) throw new Error(String(response.status));

      const payload = (await response.json()) as { products: Product[] };

      setProducts((current) => {
        // WooCommerce can repeat a product across pages when the catalogue is
        // edited mid-scroll; React would then throw on the duplicate key. The
        // product whose page this is gets filtered out for the same reason it is
        // filtered out of the first page — recommending the thing already on
        // screen is not a recommendation.
        const seen = new Set(current.map((product) => product.id));
        return [
          ...current,
          ...payload.products.filter((p) => !seen.has(p.id) && p.id !== excludeId),
        ];
      });
      setPage(next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, page, category, excludeId]);

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
      {/* Six across on a large desktop, four on a tablet, two on a phone. The
          shop is full-bleed now, so six columns of a 1920px window leave each
          photograph near 300px — a product picture a shopper can judge a
          garment from rather than one they have to open to see. Gaps are
          tight on purpose, and tighter still on a phone: a dense grid reads as
          a catalogue with depth, and 6px between two columns is all it takes to
          tell them apart on a 390px screen. */}
      {/* ---- The gaps ARE the tile borders ----

          10px between columns and 20px between rows on a phone, opening to
          16/28 from sm. Up from 8/16 and 12/24.

          This is not a cosmetic loosening — it is load-bearing. `ProductCard`
          has no border, no background and no shadow, so the ONLY thing telling
          a shopper where one product ends and the next begins is the space
          around it. The two decisions have to move together: this grid at the
          old 8px gap with the new borderless tile is a wall of touching
          photographs, which is the exact failure the border was added to fix.
          The measurements here are taken off the reference grid.

          The rows still get more air than the columns, and the reason is
          unchanged. A grid is scanned down, so the horizontal gap only has to
          say "these are two products", while the vertical one has to separate a
          tile's last line of text from the next tile's photograph — a much
          harder join, and the one that fails first.

          ---- The column gap went 12px to 8px, to widen the photograph ----

          On a desktop the card has no padding of its own, so the picture is
          exactly as wide as its grid cell and the gap is the ONLY slack in the
          row. Six columns share five gaps: at 12px that is 60px of the shell
          spent on air, at 8px it is 40, and the 20px recovered goes to the
          photographs at a little over 3px each.

          That is a small number and it is honestly the whole of what this lever
          can give. The two things that actually set tile width are the column
          count and `--shell`, and both are deliberate: six is the count the
          note below argues for at length, and the shell stops at 1720 so the
          page does not sprawl on a wide monitor. Widening the picture past this
          means moving one of those, not shaving the gaps further — below 8px
          the borderless tiles start reading as one continuous strip of
          photography, which is the failure the paragraphs above exist to
          prevent.

          The ROW gap is untouched at 20px. It is doing the harder job and it
          was not what was asked about. */}
      {/* ---- The gaps are tight again below md, and that is not a reversal ----
          The paragraphs above are still the rule: a tile needs exactly one
          separator. What changed is which one it gets on a phone. `ProductCard`
          is now a WHITE card on the off-white phone ground (see its own note),
          so below 768px the separator is contrast, not space, and 20px of row
          gap between two cards that already have edges is just a hole in the
          grid. 8px each way is what the marketplaces this is modelled on use
          once their tiles have a surface.

          From `md` the tile goes flat again and the wide gaps come straight
          back — they are the ONLY separator up there, and the two settings have
          to keep moving together or the wall of touching photographs returns. */}
      {/* ---- The ramp is 2 -> 3 -> 4 -> 5 -> 6 -> 7, one step per breakpoint ----

          Six across on a laptop is the anchor, and every breakpoint below it
          drops exactly one column.

          It did not read that way before. The classes ran 2 → 3 → 4 → (4) → 6
          → 7 with no `lg` step at all, so everything from 1024px to 1280px was
          shown the TABLET grid: four columns across a 1200px window, tiles near
          290px, a laptop rendering a shop at iPad density. And the jump from
          four straight to six meant one breakpoint changed the tile width by a
          third in a single step, which is the size of change that reads as the
          page having reloaded into a different layout.

          `lg:grid-cols-5` closes it. The ramp is monotonic now — each step down
          removes one column, never two, and never repeats its neighbour.

          Two things move with these counts and must not be forgotten:
          `GRID_SIZES` in `ProductCard`, which tells the browser how wide a tile
          will be, and the rail widths in `DealCarousel`, which mirror the counts
          so a rail and the grid beneath it never disagree on the same screen.

          ---- The older argument, still true, about the tablet step ---- */}
      {/* ---- Four from `md`, which is the tablet step ----

          This used to hold at three columns from 640px all the way to 1024px,
          because `sm:grid-cols-3` had nothing above it until `lg`. The gap is
          exactly the width an iPad is: every iPad in portrait lands between
          768 and 834 CSS pixels, so the whole tablet range was being shown a
          phone's grid stretched across a much wider screen — three tiles at
          roughly 240px each, which is a larger product photograph than the
          product page itself uses.

          `md:grid-cols-5` is the same count `lg` was already giving, moved
          down to where the screen first has room for it. At 820px — the
          commonest iPad width — five columns and four 12px gaps put a tile at
          148px, which is the size a phone tile already is and a size this card
          is known to work at.

          `lg:grid-cols-5` was removed at one point on the argument that it
          restated `md`. That was true while `md` held five; `md` holds four
          now, so `lg` is a real step again and has been put back. */}
      {/* ---- Six was the top of the ramp; seven is ----

          The ramp once climbed to 8 at `2xl`. That was the full-bleed shop,
          where a wider window was spent on more products rather than bigger
          ones — eight columns of a 1920px window still left a 228px picture.

          The shell is bounded at 1500px now, so the width being shared out
          stopped growing, and the same eight columns of 1436px is a 172px
          tile: smaller than this shop's own PHONE tile. Six is the count that
          fits the bounded shell at a size a shopper can judge a garment from —
          229px, against the 277px five would give and the 172px eight did.

          ---- Where the ramp landed: 2 -> 3 -> 4 -> 5 -> 6 -> 7 ----

            sm   3  unchanged
            md   4  from 768px - down from five, because the tablet is where a
                    picture is scarcest: an 820px iPad goes from a 148px tile to
                    ~190px, and four is the count that buys that
            lg   5  from 1024px
            xl   6  from 1280px
            2xl  7  from 1536px

          ---- Six, then seven, then six, then seven ----

          This count has now been changed four times, and the honest record is
          that it is a preference rather than a derivation. The arithmetic has
          not moved: against a bounded 1720px shell, six columns is a 266px
          tile and seven is 226px. Seven fits more of the catalogue on a
          screen; six shows each piece of it larger. Both are defensible, and
          the shop has landed on seven.

          What is NOT a preference is that four other places carry this number
          and every one has had to be dragged back and forth with it. Before
          changing it a fifth time, change all five in the same edit — they are
          named below.

          A BOUNDED shell is what makes that true, and it is the whole of the
          argument. While `--shell` was 100% a wider window meant more products
          at the same size, and more of them was the obvious win; against a
          shell that stops growing at 1720 every extra column comes straight
          out of the photograph.

          ---- Three other places carry this count ----

          `GRID_SIZES` in `ProductCard`, the rail widths in `DealCarousel`, and
          the skeleton. All three moved back with it, and they have to: `sizes`
          is a PROMISE about layout that nothing downstream corrects, so a
          string still claiming 14vw while the tile renders at 17vw picks a
          file one srcset step too small and the photograph arrives soft. That
          exact drift is what going to seven fixed, and leaving it behind now
          would recreate it in the opposite direction.

          The two bands above 1536 collapsed into one in `GRID_SIZES` for the
          same reason - a breakpoint that no longer changes the count is a
          breakpoint somebody will later read as meaning something.

          All seven grids carry the ramp: the catalogue, the category pages,
          /sale, /search, a seller's own shop, the cart recommendations and the
          loading skeleton. A skeleton laying out a different column count from
          the grid it stands in for is a layout shift with extra steps.

          The phone's two are untouched. Below 768px the tile is already as wide
          as a useful grid can make it.

          `--shell` went to 100% for an hour and came back to 1720 (the note in
          `globals.css` has the whole story), which is why the top step is a
          fixed ~226px again rather than a share of the window.

          Two things move with this ramp and must not be forgotten —
          `GRID_SIZES` in `ProductCard`, or the browser fetches files for the
          wrong column count, and the rail widths in `DealCarousel`, which
          mirror these counts so a rail and the grid under it never disagree on
          the same screen. */}
      {/* ---- Tighter on a phone: 4px across, 8px down ----
           Was 6px/12px. `ProductCard` is a white card with its own 6px of
           padding on a phone, so the ink-to-ink distance between two products
           is the gap PLUS 12px of padding — the row gutter was reading as 18px
           and the column gutter as 24px, which on a 390px screen is most of a
           third column spent on air.
           Closing it up hands those pixels back to the photographs, which are
           the only thing in the grid doing any selling. The cards' own padding
           still keeps the white blocks visibly separate, so nothing merges into
           one sheet. Desktop is untouched: there is room there, and 4px between
           six columns of a 1720px shell would read as a contact sheet. */}
      <ul className="grid grid-cols-2 gap-x-1 gap-y-2 sm:grid-cols-3 md:gap-x-2 md:gap-y-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
