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
 * Everything from `sm:` up is untouched: cards, corners, gutters and all. The
 * flush treatment is a phone measure, and on a tablet the columns are wide
 * enough that the gutters were never costing the picture anything.
 */
export const PRODUCT_GRID =
  "product-grid-flush grid grid-cols-2 gap-0 " +
  "sm:grid-cols-3 sm:gap-x-2.5 sm:gap-y-3 " +
  "md:grid-cols-4 md:gap-x-3 md:gap-y-4 " +
  "lg:grid-cols-5 xl:grid-cols-6";
