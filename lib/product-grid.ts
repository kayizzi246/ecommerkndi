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
 * ---- Staggered on a phone, ruled from `sm` up ----
 *
 * Below 640px this stops being a grid at all. `.product-grid-flush` (globals.css)
 * swaps `display: grid` for CSS multi-column, and `ProductCard` gives each
 * photograph one of three frame ratios picked off the product id — so the two
 * phone columns pack independently and a tall tile pushes only its own column
 * down. That is the staggered/masonry arrangement the app uses, and a phone is
 * where it earns its place: two columns of wildly different stock, and the
 * alternative is cropping every shot to one box.
 *
 * From `sm` up the class does nothing to `display` and the `grid-cols-*`
 * utilities below govern as they always have — an even, ruled sheet. A
 * six-column masonry on a monitor reads as a layout fault rather than as a
 * catalogue, and the wider the screen the more the ragged column feet show.
 *
 * The trade on the phone half is reading order: multi-column fills column one
 * top to bottom before column two, so the DOM order runs down the columns
 * rather than across the rows. For a catalogue — an unordered set of products
 * a shopper scans — that is the natural order anyway.
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
 * ---- Five across, and six once there is a monitor for it ----
 *
 * `2xl` (1536px and up) takes a sixth column. That is the width where five
 * tiles of a 1720px shell are ~343px each — wider than the photograph needs and
 * wide enough that the grid starts reading as a shelf of six large objects
 * rather than as a catalogue. Below it, five.
 *
 * ---- Why five is the floor for a laptop ----
 *
 * The count has been five, then six, and is five again — asked for on the
 * screen it is actually read on. Six columns of a 1720px shell is a 266px
 * tile, and the tile carries a lot: two lines of name, a saving chip, a price
 * pair, a stock line and a rating row. At 266px those wrap and truncate; at
 * the 324px five columns give, they do not.
 *
 * Six at a laptop width is only wider than five in the sense that it fits one
 * more picture on the screen. It is narrower in the sense that matters — the
 * picture itself, which is what a shopper is choosing from. At 1536px there is
 * room for both, which is why the column comes back there and not sooner.
 *
 * `sizes` follows this ramp in two places — `GRID_SIZES` in `ProductCard`, and
 * the spelled-out string on the category page, which is full-bleed and so does
 * the arithmetic itself. All three move together or the shop downloads
 * photographs the wrong size for the boxes they land in.
 */
export const PRODUCT_GRID =
  "product-grid-flush grid grid-cols-2 " +
  "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6";

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
 * One column ahead of the shared grid from xl up — six where the shop shows
 * five, seven where it shows six. The store page is full-width and its whole
 * job is showing everything one seller has, so the extra column earns its place
 * there and nowhere else; below xl there is no spare width to take it from.
 *
 * The offset is the invariant worth keeping, not the numbers. When the shared
 * ramp moves, this moves with it and stays exactly one ahead.
 */
export const PRODUCT_GRID_WIDE =
  "product-grid-flush grid grid-cols-2 " +
  "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7";
