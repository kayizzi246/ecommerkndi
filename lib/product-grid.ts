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
 * ---- Wider cards from lg up ----
 *
 * Six across at xl and five at lg was a column count chosen when the tile
 * carried less: it now has a two-line name, a saving line, a price row with a
 * struck original, and a stock line under that. At 1920px six columns put a
 * photograph at about 240px with four rows of text under it, and the text was
 * winning an argument it should not have been in.
 *
 * Five and four. Each card gains roughly a fifth of its width, which all goes
 * to the photograph — the text block is a fixed number of rows and does not
 * grow — and the row still reads as a catalogue rather than a shelf.
 *
 * The gutters come in at the same time. They were sized for narrow tiles that
 * needed separating; wider cards with a hairline of their own separate
 * themselves, and the space is better spent on the pictures.
 */
export const PRODUCT_GRID =
  "product-grid-flush grid grid-cols-2 gap-0 " +
  "sm:grid-cols-3 sm:gap-x-2 sm:gap-y-2.5 " +
  "md:grid-cols-4 md:gap-x-2.5 md:gap-y-3 " +
  "lg:grid-cols-4 xl:grid-cols-5";
