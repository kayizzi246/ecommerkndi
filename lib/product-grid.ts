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
 * ---- The phone gaps are the point of this file ----
 *
 * They were `gap-x-2.5 gap-y-3` — 10px and 12px. That is desktop spacing
 * applied to a 360px screen, where the two columns it has to divide are already
 * only about 165px wide each: every pixel of gutter comes straight out of the
 * photograph, which is the thing a shopper is actually scanning. Tightened to
 * 6px and 8px, which on a phone reads as a denser shelf rather than a cramped
 * one, because each tile is a card with 6px of its own padding — so the gap
 * between two product photographs is still 18px, and the visible channel
 * between the cards is what shrank.
 *
 * Everything from `sm:` up is unchanged. On a tablet and above the columns are
 * wide enough that the old gutters were never taking anything from the picture.
 */
export const PRODUCT_GRID =
  "grid grid-cols-2 gap-x-1.5 gap-y-2 " +
  "sm:grid-cols-3 sm:gap-x-2.5 sm:gap-y-3 " +
  "md:grid-cols-4 md:gap-x-3 md:gap-y-4 " +
  "lg:grid-cols-5 xl:grid-cols-6";
