"use client";

import type { Product } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";
import ProductFeedFooter from "@/components/ProductFeedFooter";
import { useProductFeed, type ProductFeedQuery } from "@/lib/use-product-feed";

/**
 * The endless product grid.
 *
 * Page one arrives with the server render, so the shop is never empty on
 * arrival and a crawler sees real products; everything after it is fetched as
 * the shopper reaches the bottom. The paging itself lives in `useProductFeed`,
 * which four grids now share — see that file for what it guarantees.
 *
 * ---- It is not just the homepage any more ----
 *
 * This drew the homepage's "Picked for you" and the suggestions under a product
 * page, and both wanted the same thing: the plain catalogue, optionally
 * narrowed to one category. /sale, /search and the category pages were
 * paginated instead, with numbered links at the foot.
 *
 * They are all infinite now, and `query` is what made that possible: the grid
 * no longer assumes "the catalogue" but is told which listing it is a page of,
 * and passes the same narrowing to `/api/products` that the server used for
 * page one. That is the part that has to be right — a grid whose page two is a
 * different query from its page one is a grid that silently mixes two lists.
 */
export default function InfiniteProducts({
  initialProducts,
  totalPages,
  /**
   * The listing this grid is a page of.
   *
   * Defaulted to the whole catalogue, so the two callers that always wanted
   * that — the homepage grid and a product page's suggestions, which passes a
   * category — did not have to change shape.
   */
  query = {},
  excludeId,
  /** What the footer says once there is nothing left. */
  doneLabel,
}: {
  initialProducts: Product[];
  totalPages: number;
  query?: ProductFeedQuery;
  excludeId?: number;
  doneLabel?: string;
}) {
  const feed = useProductFeed({ initialProducts, totalPages, query, excludeId });

  if (feed.products.length === 0) return null;

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
      <ul className="grid grid-cols-2 gap-x-2.5 gap-y-3 sm:grid-cols-3 md:gap-x-3 md:gap-y-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {feed.products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      <ProductFeedFooter feed={feed} doneLabel={doneLabel} />
    </>
  );
}
