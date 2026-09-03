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
 * ---- The phone grid has no gutters at all ----
 *
 * It went 10/12px, then 6/8px, and now none. Every pixel of gutter on a 360px
 * screen comes straight out of a photograph: two columns are about 165px each
 * before anything is taken, and the picture is the entire reason a tile exists.
 *
 * Removing the gap is only half of it. Two 14px-rounded cards pushed together
 * leave a white notch at each corner and put their two hairlines side by side,
 * which reads as a rendering fault rather than as a decision. So the grid also
 * carries `product-grid-flush`, and the rule behind that class (globals.css)
 * squares the corners on a phone and replaces each tile's ring with a single
 * right-and-bottom hairline — so the tiles become one continuous sheet divided
 * by 1px lines, which is what every marketplace's phone grid actually is.
 *
 * ---- Five across, and this time it stays ----
 *
 * The count has been five, then six, and is five again — asked for on the
 * screen it is actually read on. Six columns of a 1720px shell is a 266px
 * tile, and the tile carries a lot: two lines of name, a saving chip, a price
 * pair, a stock line and a rating row. At 266px those wrap and truncate; at
 * the 324px five columns give, they do not.
 *
 * Six is only wider than five in the sense that it fits one more picture on
 * the screen. It is narrower in the sense that matters — the picture itself,
 * which is what a shopper is choosing from.
 *
 * ---- The gutters, tighter again ----
 *
 * 6/8px across, 8/10px down, from sm and md. Rows still get more air than
 * columns, for the reason every grid discovers: a shopper scans downwards, so
 * the join that has to stay legible is one tile's last line of text against
 * the next tile's photograph, not two photographs side by side.
 *
 * `sizes` follows this ramp in two places — `GRID_SIZES` in `ProductCard`, and
 * the spelled-out string on the category page, which is full-bleed and so does
 * the arithmetic itself. All three move together or the shop downloads
 * photographs the wrong size for the boxes they land in.
 */
export const PRODUCT_GRID =
  "product-grid-flush grid grid-cols-2 gap-0 " +
  "sm:grid-cols-3 sm:gap-x-1.5 sm:gap-y-2 " +
  "md:grid-cols-4 md:gap-x-2 md:gap-y-2.5 " +
  "lg:grid-cols-5";

/**
 * The same grid with one more column, for a single store's page.
 *
 * A separate constant rather than `PRODUCT_GRID` plus an `xl:grid-cols-7`
 * override. Both classes would set the same property at the same breakpoint,
 * and which one won would come down to the order Tailwind happened to emit them
 * in — not the order they are written in the class list. That is a coin flip
 * dressed up as a rule, and it is the kind that works in development and lands
 * wrong once.
 *
 * Six only from xl. The store page is full-width and its whole job is showing
 * everything one seller has, so the extra column earns its place there and
 * nowhere else — and below xl there is no spare width to take it from.
 *
 * It was seven while the shared grid was six. It steps down with it, so the
 * store page stays exactly one column wider than the rest of the shop rather
 * than drifting two ahead of it.
 */
export const PRODUCT_GRID_WIDE =
  "product-grid-flush grid grid-cols-2 gap-0 " +
  "sm:grid-cols-3 sm:gap-x-1.5 sm:gap-y-2 " +
  "md:grid-cols-4 md:gap-x-2 md:gap-y-2.5 " +
  "lg:grid-cols-5 xl:grid-cols-6";
