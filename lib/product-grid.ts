/**
 * The one product grid, so every listing in the shop counts columns and gaps
 * the same way.
 *
 * This exact string was written out seven times — the category page, search,
 * sale, a store page, the infinite feed, the homepage's picked-for-you shelf and
 * the loading skeleton — and they had already begun to drift: one of them
 * ordered its breakpoints differently, and the skeleton is supposed to occupy
 * the columns the real tiles land in. A grid whose placeholder is a different
 * shape from its content re-lays-out the moment the data arrives.
 *
 * ---- Two across on a phone ----
 *
 * This went to three for one build and came straight back. Three fits more on a
 * screen and the arithmetic for it was sound — a phone grid is scanned rather
 * than read, and nine products beat four at the rejecting stage. What it looked
 * like is the thing that decided it: a 391px screen split three ways is a 128px
 * tile, and at that width the photograph stops being a photograph. A shopper
 * cannot reject nine things they cannot see.
 *
 * So the phone keeps two, and the density work that came with the third column
 * went back with it — the tile's padding and the corner discount flag were both
 * shrunk to survive 120px and have no reason to be small at 195px.
 *
 * `sm` is back in the ramp as the 2 → 3 step: 2 → 3 → 4 → 5 → 7, at sm, md, lg
 * and 2xl.
 *
 * ---- Staggered on a phone, ruled from `sm` up ----
 *
 * Below 640px it stays a two-column grid, and `.product-grid-flush`
 * (globals.css) drops the right-hand column by a fixed offset so the rows read
 * as a staggered brick pattern. An earlier CSS-columns masonry was dropped
 * because it rebalanced on every feed append and tiles jumped columns
 * mid-scroll; an offset grid never moves a tile once it has landed.
 *
 * From `sm` up the grid is level — a staggered seven-column sheet on a monitor
 * reads as a layout fault rather than as a catalogue.
 *
 * ---- No gutters at all, at any width ----
 *
 * The phone grid went 10/12px, then 6/8px, then none — every pixel of gutter on
 * a 360px screen comes straight out of a photograph. The rest of the ramp has
 * now followed it down for the same reason, one screen size at a time: 8px
 * between columns is 8px not spent on the picture, and the picture is the
 * entire reason a tile exists.
 *
 * Removing the gap is only half of it. Two 14px-rounded cards pushed together
 * leave a white notch at each corner and put their two hairlines side by side,
 * which reads as a rendering fault rather than as a decision. So the grid also
 * carries `product-grid-flush`, and the rule behind that class (globals.css)
 * squares every corner and replaces the per-tile ring with a 1px grid gap over
 * the edge colour — the tiles become one continuous sheet divided by hairlines,
 * which is what a marketplace grid actually is.
 *
 * That rule owns the gap now, so there are no `gap-*` utilities in these
 * strings any more. There cannot be two owners of one property: the class is
 * unlayered and a utility is not, so the class would win and the utility would
 * be a comment that looks like code.
 *
 * ---- Five across, and seven once there is a monitor for it ----
 *
 * `2xl` (1536px and up) takes the grid to seven columns. At a 1720px shell,
 * each tile is about 236px wide, keeping the page dense without shrinking the
 * product photograph below a useful size. Below it, five.
 *
 * ---- Why five is the floor for a laptop ----
 *
 * The count has been five, then six, and is five again — asked for on the
 * screen it is actually read on. Seven columns at 1720px gives a 236px tile,
 * which works with the compact, single-line product name and price rows.
 *
 * Seven at a laptop width would make the photos too small, so the extra two
 * columns begin at 1536px, where the desktop grid has enough room.
 *
 * `sizes` follows this ramp in two places — `GRID_SIZES` in `ProductCard`, and
 * the spelled-out string on the category page, which is full-bleed and so does
 * the arithmetic itself. All three move together or the shop downloads
 * photographs the wrong size for the boxes they land in.
 */
export const PRODUCT_GRID =
  "product-grid-flush grid grid-cols-2 " +
  "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6";

/**
 * The grid with one extra `xl` column for a seller storefront.
 *
 * A separate constant rather than `PRODUCT_GRID` plus an `xl:grid-cols-7`
 * override. Both classes would set the same property at the same breakpoint,
 * and which one won would come down to the order Tailwind happened to emit them
 * in — not the order they are written in the class list. That is a coin flip
 * dressed up as a rule, and it is the kind that works in development and lands
 * wrong once.
 *
 * One column ahead of the shared grid from `xl` to `2xl`. Both cap at seven
 * columns at `2xl`; keeping the same maximum preserves useful product-image
 * size on wide screens.
 *
 * The extra column begins at `xl`, where the store has room for it.
 */
export const PRODUCT_GRID_WIDE =
  "product-grid-flush grid grid-cols-2 " +
  "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6";
