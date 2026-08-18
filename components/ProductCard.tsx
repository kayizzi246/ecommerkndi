import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import WishlistButton from "@/components/WishlistButton";
import TileCartButton from "@/components/TileCartButton";

/** At or below this many units, the card says how few are left. */
const LOW_STOCK_AT = 5;

/** "2.2K sold" — the compact form marketplaces print beside a price. */
function compactSold(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

/**
 * Five dark stars, filled to the rating.
 *
 * Dark rather than gold: on a card this dense the stars are a measurement, not
 * a decoration, and a row of gold pulls the eye off the price sitting directly
 * above it. Half-steps are rounded to the nearest whole star — at 11px a half
 * star is indistinguishable from a full one anyway.
 */
function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating);

  return (
    <span className="flex items-center gap-[1px]" aria-label={`Rated ${rating.toFixed(1)} of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          aria-hidden
          className={`h-[11px] w-[11px] ${index < filled ? "text-shop-ink" : "text-shop-line"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5Z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * The one product card the whole store uses — every grid, rail and carousel.
 *
 * Chrome-free, on the Taobao model: no border, no shadow, no card background,
 * no padding. The photograph sits directly on the page with a 10px radius, the
 * text runs flush to its left edge, and what separates one product from the
 * next is the GAP around it.
 *
 * ---- This is the third position on that question, so here is the rule ----
 *
 * A tile needs exactly one separator, and it can be an edge OR a gap. It must
 * not be neither, and it does not want both.
 *
 *   • It was gaps alone, on an off-white page. Correct: the page colour ran
 *     between the tiles and did the work.
 *   • The content sheet went white, and gaps alone stopped working — white
 *     tiles on white with 8px between them have no boundary at all, and a row
 *     of four products read as one wide picture with words underneath.
 *   • A hairline border fixed that, and is now removed again: the grid is going
 *     back to gaps, but this time with gaps WIDE enough to separate on their
 *     own. That is the half that was missing the first time.
 *
 * So the borders came out and the grid gaps went up together, in
 * `InfiniteProducts` and `DealCarousel`. Removing one without raising the other
 * is what produced the wall of touching photographs, and it is the specific
 * mistake to avoid if this is ever revisited.
 *
 * No shadow either, at rest or on hover — argued at the `<article>` below.
 *
 * The order is the one every large marketplace has converged on, and it is an
 * order of decreasing importance rather than a description of the product:
 *
 *   image → name → price, was-price and discount on one line →
 *   rating and units sold → the delivery promise.
 *
 * Four text rows, and always the same four. Every tile in the shop is therefore
 * exactly as tall as every other tile, which is what lets a rail of them read as
 * a row rather than as a ragged fence. The rows that used to come and going with
 * the data — a saving, a size list, a "Best Seller in Shoes" — are gone, and the
 * detail block below carries the full argument for why.
 *
 * The price sits under the name rather than above it, and at 15px rather than
 * the 19 it once ran at: it is still the first thing read in the text, because
 * it is bold and near-black against a 14px name, but the photograph is what
 * should set the tile's rhythm. The struck-through original and the reduction
 * sit beside it rather than on lines of their own — the three numbers only mean
 * anything read together.
 *
 * Colour is rationed: the resting price is near-black and only a discounted one
 * turns red, so red still means something; green is delivery and nothing else.
 *
 * Every figure comes from WooCommerce, and a row with no number behind it
 * renders empty rather than printing a zero or collapsing.
 */
/**
 * How wide this tile renders, as a `sizes` hint for the browser.
 *
 * The grid widths, since most cards are in a grid. A rail passes its own —
 * see below for why that is worth the prop.
 */
const GRID_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 20vw, 17vw";

export default function ProductCard({
  product,
  priority = false,
  sizes = GRID_SIZES,
}: {
  product: Product;
  /**
   * Load this card's photo immediately rather than lazily.
   *
   * Set only on the handful of cards that are already on screen when the page
   * opens. A lazy image is not requested until the browser has finished laying
   * the page out, which on a phone puts the shop's largest paint — the first
   * product photo — several hundred milliseconds behind where it could be. Off
   * by default: making every card eager would have them all compete for
   * bandwidth and would be slower than doing nothing.
   */
  priority?: boolean;
  /**
   * The width this tile actually occupies, per breakpoint.
   *
   * This is the single biggest lever on how fast product photography arrives,
   * and it was wrong everywhere the card appeared in a rail. `sizes` is what
   * the browser uses to pick a file out of the `srcset`; it is a promise about
   * layout, and a wrong one is not corrected by anything downstream. The value
   * was hard-coded to the grid's `50vw` on mobile, so a rail tile that renders
   * at 27vw was still being served the 50vw file — roughly four times the
   * pixels it can display, downloaded and decoded on a phone connection, for
   * every tile in every rail on the homepage.
   *
   * Defaulted rather than required so the several grids that were already
   * correct stay untouched.
   */
  sizes?: string;
}) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const soldOut = product.stock_status === "outofstock";
  const lowStock =
    !soldOut && product.stock_quantity !== null && product.stock_quantity <= LOW_STOCK_AT;

  // Readable URLs — /products/blue-running-shoes, not /products/190.
  const href = `/products/${product.slug || product.id}`;

  /** The back view, when the seller uploaded one. */
  const secondPhoto = product.gallery.find((url) => url && url !== product.image) ?? null;

  /* ---- What used to be computed here, and where it went ----
   *
   * The tile also derived a shillings-off saving, a chosen size attribute with
   * its deduplicated options, and a colour-versus-text decision for drawing
   * them. All of it fed rows that rendered on some products and not others,
   * which is what made neighbouring tiles different heights — see the detail
   * block below for the full argument.
   *
   * None of it is lost to the shopper: the reduction is still on the tile as a
   * percentage twice over (the corner flag and the figure beside the price), and
   * sizes and colours are on the product page, which is the screen where they
   * are chosen rather than merely previewed. Deleting the derivations rather
   * than leaving them unused keeps the component honest about what it renders.
   */

  return (
    // Corners are 10px, up from 3.
    //
    // This reverses an earlier decision, and the earlier reasoning was sound on
    // its own terms: a nearly square photograph reads as the product itself
    // rather than as a card floating on the page, and at 2.5 tiles per phone
    // screen a large radius eats a visible bite out of a 150px image.
    //
    // What it missed is that a radius is what makes a tile look *made*. Taobao,
    // Temu and AliExpress all round their tiles at roughly this much, and the
    // grid reads as a set of objects rather than as photographs abutting each
    // other. 10px is the size that survives at both extremes — big enough to be
    // seen on a 150px phone tile, small enough that a 300px desktop tile does
    // not turn into a lozenge.
    // ---- The tile now has an edge at rest, not only on hover ----
    //
    // This was `border-transparent` with the hairline appearing on hover, which
    // worked when the tile sat on an off-white page: the white of the card was
    // itself the boundary, and a border would have been drawing a line that the
    // colour change already drew.
    //
    // The content sheet is white now (see `StoreChrome`), so a white tile on it
    // has no boundary at all — the grid became photographs and text floating in
    // space with nothing saying where one product ends and the next begins. In a
    // dense catalogue that is not a cosmetic problem; it is what makes a page
    // tiring to scan, because the eye has to do the grouping that the design
    // should have done for it.
    //
    // ---- No border, no background, no shadow ----
    //
    // The separation is the grid gap; see the note at the top of this file for
    // why that only works if the gaps are wide, and where they are set.
    //
    // A lift shadow was tried here and taken back out. On a grid it is the
    // wrong instrument: forty tiles each casting a soft shadow turns the gaps
    // between them grey, so the page gains a haze exactly where it should be
    // clean, and the one tile under the cursor is not much more distinguished
    // than it was. The hover now lives on the product NAME turning orange,
    // which is one colour change, costs no paint area, and keeps the grid flat.
    //
    // No `overflow-hidden` either. It was only ever there to clip the photo to
    // the card's radius, and the photo carries its own radius now. Leaving it
    // on a card with no background would clip the badges that deliberately sit
    // proud of the image.
    // ---- On a PHONE the tile is a white card again; from md up it stays flat ----
    //
    // This does not undo the borderless decision above, it splits it by screen,
    // because the two screens were never the same problem.
    //
    // DESKTOP is unchanged: a 1600px column, six tiles across, wide gaps, a dark
    // masthead over it. The page is white, the tiles are flat on it, and the gaps
    // do the separating. Every word of the argument above still holds there.
    //
    // PHONE is where it stopped working. The page ground below 768px is #f9fafb
    // (see the `@media` block in `globals.css`), the rails are gone, and what is
    // left is two columns running the full width of the glass. A flat tile on
    // that tint means the PRODUCT PHOTOGRAPH — most of this catalogue shot on
    // white — is the only white thing on the screen, so each tile reads as a
    // picture dropped on a grey sheet with loose text under it rather than as an
    // object. The text sits on the tint too, which is the part that looks
    // unfinished: a price and a name floating on the page ground belong to the
    // page, not to the photograph above them.
    //
    // The white card fixes both at once. It gives the whole tile — photo, name,
    // price, rating, delivery line — one surface, so the four rows visibly
    // belong to the picture; and because the ground is off-white and the card is
    // white, the tile now has a real edge without a border, a shadow or a wide
    // gap. That is the same "a tile needs exactly one separator" rule from the
    // top of this file, satisfied by CONTRAST instead of by space, which is the
    // cheaper way to satisfy it on a 390px screen where space is the scarce
    // thing.
    //
    // `p-1.5` is 6px, and the radii are picked to match it: a 12px outer corner
    // with 6px of padding wants a 6px inner corner, which is why the photo below
    // is `rounded-md` on a phone and keeps its `rounded-lg` from md up. An inner
    // radius larger than (outer − padding) is what makes a card look like two
    // rectangles that missed each other.
    //
    // Everything is `md:` reset rather than conditionally rendered, so there is
    // still exactly ONE card component and one set of rows — the difference
    // between the two screens is four utilities, not a second tile.
    // ---- One flat tile, on every screen ----
    //
    // The white phone card written about above is gone, and so is the reason it
    // existed: the page ground below 768px was #f9fafb, so a card was the only
    // way to give the tile an edge. The ground is white now at every width (see
    // the note where that media query used to be in `globals.css`), which makes
    // a white card a white rectangle on a white page — an edge that is not
    // there, costing 6px of padding all the way round for it.
    //
    // So the tile is chrome-free again, phone included, which is what the
    // reference grid does: no border, no background, no shadow, no padding. The
    // photograph's own light-grey frame is the only fill in the tile, the text
    // runs flush to its left edge, and what separates one product from the next
    // is the gap around it.
    <article className="group relative flex h-full flex-col">
      {/* ---- Image ---- */}
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          {/* Square, down from 4:5 — a quarter shorter.

              The 4:5 crop was argued for on the grounds that clothes and shoes
              are photographed standing up, so the extra height goes to the
              garment rather than to floor and ceiling. That is true of a
              fashion catalogue and false of this one: the shop sells wardrobes,
              shoe racks, air pumps, curtains and milk, most of it photographed
              square by the supplier, and a 4:5 frame around a square photograph
              is 25% empty space by construction.

              Square is also what every marketplace tile this grid is modelled
              on uses, and the reason is arithmetic rather than taste: a shorter
              tile puts more rows on a screen, and on a page whose job is to
              show a catalogue, rows are the product.

              ---- Briefly 5:4, and back to square ----

              It was cut to 5:4 to make the tile shorter still, then measured
              against the reference grid and put back. That measurement is the
              argument: in the reference a tile is 251px wide and its photograph
              is 248px tall, which is square to within a pixel.

              Square is also where the cropping stops. `object-cover` fills the
              box, so 5:4 was taking roughly 10% off the top and 10% off the
              bottom of every square supplier photograph — fine on a centred
              product shot, and a clipped toe on a pair of boots shot upright.
              At 1:1 a square source is untouched, which is most of this
              catalogue.

              The height that was wanted from 5:4 has been found elsewhere
              instead, and more cheaply: the meta row below went 16px → 13px and
              the text block lost its padding, so the tile is shorter than it
              was without a pixel coming off the photograph.

              ---- 8px corners, down from 10 ----

              Measured off the same reference. The difference is small and it is
              the difference between a tile that looks drawn to a spec and one
              that looks approximately styled. */}
          {/* One radius at every width now that there is no card for the photo
              to sit inside — the concentric-corner arithmetic that made this
              `rounded-t-xl` on a phone went with the card.

              `bg-shop-hairline` behind it is doing real work on a white page:
              it is the frame the reference grid uses, and it is what gives a
              product shot on white an edge without a border being drawn. */}
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-shop-hairline">
            {product.image ? (
              <>
                {/* The eager branch below is `loading="eager"` +
                    `fetchPriority="high"`, not `priority`. Next 16 deprecated
                    `priority` in favour of `preload`, but `preload` is
                    explicitly the wrong tool here: the docs say not to use it
                    when several images could be the LCP depending on viewport,
                    and this flag is set on the first two tiles of a rail —
                    exactly that case. Two `<link rel=preload>` tags in the head
                    would fight each other. Eager loading with a high fetch
                    priority gets the same head start without the contention. */}
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes={sizes}
                  {...(priority
                    ? { loading: "eager" as const, fetchPriority: "high" as const }
                    : { loading: "lazy" as const })}
                  className={`object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02] ${
                    soldOut ? "opacity-50" : ""
                  } ${secondPhoto ? "group-hover:opacity-0" : ""}`}
                />

                {/* The second photograph, revealed on hover.
                    A shopper's first question about a garment is what the other
                    side looks like, and answering it without a page load is the
                    single most effective thing a tile can do. Only rendered when
                    the product genuinely has a second shot — a "hover" that
                    shows the same picture again reads as a glitch. */}
                {secondPhoto && (
                  <Image
                    src={secondPhoto}
                    alt=""
                    aria-hidden
                    fill
                    sizes={sizes}
                    loading="lazy"
                    className="object-cover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                  />
                )}
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-shop-muted">
                <svg className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <circle cx="8.5" cy="10" r="1.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 3-2 4 3" />
                </svg>
                <span className="text-[12px]">No image</span>
              </div>
            )}
          </div>
        </Link>

        {soldOut && (
          <span className="absolute left-2 top-2 rounded bg-shop-ink px-2 py-0.5 text-[11px] font-semibold text-white">
            Sold out
          </span>
        )}
        {/* ---- The discount flag ----
             A percentage on the photograph, and the argument for it is narrow
             enough to be worth writing down, because it was deliberately
             removed once.

             What was removed was a 56px orange medallion stamped across the
             middle of every discounted product. That was correct to kill: it
             covered the merchandise, and orange is this shop's brand colour, so
             a grid of forty of them read as decoration rather than as a
             number. What replaced it — the percentage beside the price — is
             where the number *means* the most, sitting between what the item
             costs and what it cost.

             But the price block is the last thing read, and on a rail that a
             thumb flicks past in under a second it is often the only thing not
             read at all. The discount is the single strongest reason to stop,
             and it was the one signal with no presence in the part of the tile
             a shopper actually looks at.

             So it is back — as a corner flag, not a medallion: 11px, top
             right, out of the subject of the shot, in sale red rather than the
             brand orange, and only on products with a genuine reduction. It
             does not replace the figure beside the price; that stays, because
             the two do different jobs — this one stops the scroll, that one
             closes the sale. */}
        {!soldOut && discount > 0 && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-shop-sale px-1.5 py-[3px] text-[11px] font-bold leading-none text-white">
            −{discount}%
          </span>
        )}

        {/* The reference card carries no heart, so it appears on hover — and on
            focus, so it stays reachable from the keyboard. Wishlisting is real
            functionality here; hiding it entirely would remove a feature to
            match a screenshot. */}
        <div className="absolute left-2 top-2 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <WishlistButton
            productId={product.id}
            name={product.name}
            image={product.image}
            price={product.price}
            /* ---- A hairline ring where the shadow used to be ----
               These two controls float over a product PHOTOGRAPH, which can be
               any colour including white — most of this catalogue is shot on
               it. A white disc with no shadow on a white background is not a
               subtle button, it is an invisible one, so dropping the shadow
               without replacing it would lose the control entirely on a good
               half of the grid.

               A 5%-black ring is the flat equivalent: it is a drawn edge rather
               than a cast shadow, so it adds no haze to the page and no soft
               grey halo to the photograph, and the button is still findable on
               any ground. This is the same reasoning as the cart badge's ring
               in the masthead. */
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-shop-body ring-1 ring-black/5 backdrop-blur-sm transition-colors hover:text-shop-primary"
            iconClassName="w-[16px] h-[16px]"
          />
        </div>

        {/* Add-to-bag rides the corner of the photograph rather than sitting in
            the text below it. It buys back a whole line of the tile, and it is
            where a thumb already is after tapping the picture. */}
        {/* Ringed rather than shadowed, for the reason on the wishlist button
            above: a white disc on a white product shot needs a drawn edge. */}
        <div className="absolute bottom-2 right-2 rounded-full bg-white/95 ring-1 ring-black/5 backdrop-blur-sm">
          <TileCartButton product={product} />
        </div>
      </div>

      {/* ---- Detail ----
           Four rows, always the same four, each a fixed height. That is the
           whole design of this block and it is worth saying why, because it
           replaced something more informative.

           ---- Why every tile is now identical ----

           This used to render up to seven rows, most of them conditional: a
           "Save UGX 5,000" line only on discounted products, a rating row only
           on reviewed ones, a size or colour list only where the seller had
           filled the attribute in, a "Best Seller in Shoes" line only past 50
           sales. Every one of those was a good line on its own. Together they
           meant no two tiles in a grid were the same height, and the text under
           a row of four products started at four different places.

           In a grid that is merely untidy. In a rail it is worse: the tiles
           stretch to the tallest one, so a single product with five extra lines
           of metadata added that much empty space to the bottom of every other
           tile in the row. The information was being bought with the row's
           alignment, and on a page that is eight rails deep the alignment is
           what makes it scannable.

           So the variable rows are gone and the four that survive are the four
           every product genuinely has: what it is, what it costs, how it is
           rated, and when it arrives. The rating row renders even when there is
           nothing to put in it — an empty box of the right height, rather than a
           missing row that shortens the tile.

           ---- Space: none BETWEEN the rows, some AROUND them ----

           `gap-0` still. Each row already carries its own leading, which is the
           space; a flex gap on top of that was a second helping of it, stacked
           six times under every tile in the shop. That part was right and has
           not changed.

           ---- No horizontal inset, now that there is no card ----

           The text was briefly padded in from the tile's edges, which was right
           while the tile had a border: copy running hard against a drawn edge
           reads as text that overflowed rather than text that was placed.

           There is no edge any more, so there is nothing to inset from, and
           padding here would only push the name away from the photograph it
           belongs to — the product name and the picture should share a left
           margin, which is what makes a column of tiles line up down the page.
           This is what the reference does and it is the right call for a
           borderless tile.

           It also gives the width back. A phone tile is about 150px at 2.5
           tiles per screen, so 16px of horizontal padding was over a tenth of
           the name row — roughly two characters off a supplier's already
           truncated title, on every tile in the shop, and Poppins had taken
           some of that width already (see `layout.tsx`).

           `pt-2` stays. The gap between the photograph's bottom edge and the
           first line of the name is the one piece of vertical spacing in this
           block that is not simply a row's own leading, and at 8px it matches
           the reference. */}
      <div className="flex flex-1 flex-col gap-0 pt-2">
        <Link href={href} className="block">
          {/* Exactly two lines, always — `h-8` is 2 × the 16px leading, and it
              is a fixed height rather than a clamp so that a short name reserves
              the second line instead of pulling the price up under it. This is
              the single biggest contributor to tiles matching.

              13px, down from 14. The name is no longer competing with the price
              for the eye: the price is a different family at 800 now (see
              `.price` in globals.css), so the name does not need size to stay
              subordinate — and a step down buys roughly two more characters
              before the ellipsis on a 150px phone tile, which is the whole
              difference between "Men's Leather Officia…" and a title a shopper
              can act on. */}
          <h3 className="font-normal-heading line-clamp-2 h-8 text-[13px] leading-[16px] text-shop-ink transition-colors hover:text-shop-primary">
            {product.name}
          </h3>
        </Link>

        {/* The money, all on one line: what it costs, what it cost, and the
            reduction. A discounted price turns red — the one place red is
            allowed — because at a glance the colour is the discount.

            15px, down from 19. At 19 the price was the loudest thing in the
            tile by a wide margin and set the tile's rhythm; the photograph is
            meant to do that. 15 still reads first among the text — it is bold,
            near-black and sits under a 14px name — without shouting over the
            product it belongs to. */}
        {/* ---- Money ----
             What it costs, what it cost, and the reduction.

             ---- The clipping bug this fixes ----

             The row is a fixed height, which is what keeps every tile in a rail
             the same size. On a 382px phone showing 2.5 tiles, a tile is about
             150px wide and the three figures — "UGX 120,000  UGX 300,000  −10%"
             — need roughly double that. Nothing here said they could not wrap,
             so the price broke onto a second line and the fixed height cut it in
             half: shoppers saw "UGX" above a sliced row of digits.

             Two changes, and both are needed. `whitespace-nowrap` stops a price
             ever breaking mid-number, because a price split across two lines is
             unreadable whatever height the row is. And below `sm` the
             struck-through original and the percentage are dropped entirely
             rather than squeezed: the discount is already on the photograph as
             a corner flag, so nothing is lost, and the resting price gets the
             whole width to itself.

             The price is a step smaller on a phone as well — 13px against 15 —
             which is the size it needs to be to sit comfortably in 150px. */}
        {/* The sizes are gone from this row.
             `.price` and `.was-price` carry them now — 18px/700 and 12px/400,
             the shop's type scale — so a tile cannot drift away from the rest
             of the store the way this did when it kept its own 13/15px. The row
             is 22px rather than 20 to fit the taller price without clipping the
             comma in "UGX 145,854". */}
        <p className="flex h-[22px] items-baseline gap-x-1.5 overflow-hidden">
          {/* ---- The resting price is near-black, not orange ----
               It was orange for a while, on the argument that one saturated
               colour repeated in the same position on every tile gives the eye
               something to track down the page.

               What that argument missed is how many prices are on a screen at
               once here. Forty orange numbers is not one accent repeated, it is
               a second colour field competing with the photographs, and orange
               is also the brand — the masthead, the buttons and the links all
               use it, so a price set in it stops reading as information and
               starts reading as decoration.

               Near-black is what the product page has always used for a resting
               price, so the grid and the PDP now agree. The price is still the
               first thing read in the tile: it is the only bold line in the
               block, which is enough on a page of 400-weight grey.

               Red is unchanged and still means exactly one thing — this price
               has been reduced — with the `−N%` flag on the photograph and the
               struck-through original beside it carrying the same signal. */}
          <span
            className={`price whitespace-nowrap ${
              discount > 0 ? "text-shop-sale" : "text-shop-ink"
            }`}
          >
            {formatPrice(product.price)}
          </span>
          {discount > 0 && (
            <>
              <span className="was-price hidden whitespace-nowrap sm:inline">
                {formatPrice(product.regular_price)}
              </span>
              <span className="hidden whitespace-nowrap text-[12px] font-bold leading-none text-shop-sale sm:inline">
                −{discount}%
              </span>
            </>
          )}
        </p>

        {/* Rating and units sold — the two numbers a shopper uses to decide
            whether anyone else has taken the risk first.

            The row is always present, even with nothing in it. A product with no
            reviews and no sales is exactly the one that would otherwise render a
            shorter tile than its neighbours, and an empty 16px box costs less
            than the row of ragged baselines that hiding it caused. */}
        {/* "Reviews / sold" on the scale — 12px at the plain weight, via
             `.meta-note`. This row was 11.5px semibold, which made corroboration
             compete with the price above it. */}
        {/* ---- This row is the gap between the price and the delivery line ----
             Worth being explicit about, because it does not look like spacing
             and it is the only spacing there is. The rows are butted together
             with `gap-0`; what separates the price from "Only 3 left" is the
             HEIGHT OF THIS ROW, and on the many products with no reviews and no
             recorded sales it is an empty box.

             13px, down from 16. The row cannot go to zero — it is reserved on
             purpose so a product with no corroboration renders the same height
             as one with plenty, which is what keeps a rail's tiles aligned. But
             16px was the natural line box of 12px text at the 1.3 leading
             `.meta-note` sets, not a considered number, and the row does not
             need its text's full leading when it holds exactly one line.

             `leading-none` on the two spans is what makes 13px safe: without
             it the 15.6px line box would be clipped by `overflow-hidden` and
             the sold count would lose its descenders. The stars are 11px and
             fit either way. */}
        <div className="flex h-[13px] items-center gap-x-2 overflow-hidden">
          {product.rating_count > 0 && (
            <span className="flex items-center gap-1">
              <Stars rating={product.average_rating} />
              <span className="meta-note leading-none text-shop-body">
                {product.average_rating.toFixed(1)}
              </span>
            </span>
          )}
          {product.total_sales > 0 && (
            <span className="meta-note leading-none text-shop-muted">
              {compactSold(product.total_sales)} sold
            </span>
          )}
        </div>

        {/* The delivery promise, and the last row on every tile. `truncate` so a
            long stock message cannot wrap into a second line and undo the
            matching heights above it. */}
        {/* A block rather than a flex row, which is what makes `truncate` work.
            `text-overflow: ellipsis` has no effect on a flex container — the
            text was being sliced mid-word with no ellipsis to show for it
            ("Fastest delivery: 1 business d"). The low-stock variant keeps its
            dot by being an inline-flex span *inside* the block. */}
        <p className="h-4 truncate text-[12px] font-medium leading-4 text-shop-success">
          {soldOut ? (
            "Back in stock soon"
          ) : lowStock ? (
            <span className="inline-flex items-center gap-1.5 align-top text-shop-sale">
              <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-shop-sale" aria-hidden />
              Only {product.stock_quantity} left
            </span>
          ) : (
            /* Not "free delivery" — that depends on the basket total, and a tile
               cannot know it. Promising it here would be a lie on most orders. */
            "Fastest delivery: 1 business day"
          )}
        </p>
      </div>
    </article>
  );
}
