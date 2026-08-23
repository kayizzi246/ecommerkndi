import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import WishlistButton from "@/components/WishlistButton";
import TileCartButton from "@/components/TileCartButton";
import TileFreeDelivery from "@/components/TileFreeDelivery";

/** At or below this many units, the card says how few are left. */
const LOW_STOCK_AT = 5;

/**
 * How long a listing counts as new.
 *
 * 14 days rather than 30: "new" has to mean something a returning shopper did
 * not already see last visit, and a month-long window on a shop this size would
 * put the badge on a good part of the catalogue — the same failure the
 * `TOP_RATED_AT` thresholds exist to avoid.
 */
const NEW_FOR_DAYS = 14;

/** The most colour swatches a tile previews before it counts the rest. */
const MAX_SWATCHES = 5;

/**
 * Lifetime units sold that earn the "Bestseller" ribbon.
 *
 * 100, and the number is doing the same job as `TOP_RATED_AT`: a label most of
 * the catalogue carries is a label a shopper stops seeing. On a shop this size
 * a hundred units is a product that genuinely moves, and the ribbon appears on
 * a handful of tiles per screen rather than on most of them.
 *
 * Deliberately a threshold on real sales rather than a flag an admin can tick.
 * "Bestseller" as an editable checkbox is a claim; as a count it is a fact, and
 * the shop already has `featured` for the shopkeeper's own picks — that is what
 * the "Choice" chip is.
 */
const BESTSELLER_AT = 100;

/**
 * The social-proof ribbon, in tiers.
 *
 * One line of small words on the photograph — "Trending", "Bestseller",
 * "Popular in Uganda" — of the kind every marketplace runs, and every one of
 * them here is a threshold on `total_sales` rather than a phrase somebody typed
 * into a field. That is the whole design constraint: a shop can print any of
 * these words on any product, and the moment it does they stop being read.
 *
 * The tiers are wide apart on purpose, so the strongest word is also the rarest
 * one on a screen:
 *
 *   300+  Trending           — the top of the catalogue by units moved
 *   100+  Bestseller         — a product that genuinely sells
 *    40+  Popular in Uganda  — enough shoppers to be worth saying so
 *
 * "Popular in Uganda" rather than "Popular": every shopper here is in Uganda
 * and every seller is too, so the country is not a filter — it is the shop
 * saying the people who bought this are your neighbours, which is the one thing
 * a Kampala marketplace can say that AliExpress cannot.
 *
 * ---- What is deliberately NOT in this list ----
 *
 * "Most viewed", which was asked for. The storefront has no per-product view
 * count: `lib/seller.ts` carries views for the SELLER dashboard, from the
 * plugin's own analytics, and nothing of the sort reaches a tile. The label
 * would have had to be drawn from sales or from reviews and called views,
 * which is a made-up number in a shop where every other figure on the tile is
 * real. It needs a view counter on the product first — a field in `toProduct`
 * and something incrementing it — and then it is three lines here.
 */
const RIBBON_TIERS: { at: number; label: string }[] = [
  { at: 300, label: "Trending" },
  { at: BESTSELLER_AT, label: "Bestseller" },
  { at: 40, label: "Popular in Uganda" },
];

/**
 * What it takes to be called "Top rated" on a tile.
 *
 * Two thresholds rather than one, because either alone is meaningless. A 5.0
 * from a single review is not a verdict, and a 4.5 with no count behind it is
 * arithmetic on a sample of one. Three reviews is the smallest number where a
 * shopper's own reading of "other people bought this and were fine" holds.
 *
 * Deliberately not tuned to make the badge common. A label that most of the
 * catalogue carries tells a shopper nothing, which is the same reason the
 * Super Deal chip needs 30% rather than any reduction at all.
 */
const TOP_RATED_AT = 4.5;
const TOP_RATED_REVIEWS = 3;

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
 * takes the brand orange, so the colour still means something. Red is not a
 * price colour at all any more — it means a warning — and green is delivery and
 * nothing else.
 *
 * Every figure comes from WooCommerce, and a row with no number behind it
 * renders empty rather than printing a zero or collapsing.
 */
/**
 * How wide this tile renders, as a `sizes` hint for the browser.
 *
 * The grid widths, since most cards are in a grid. A rail passes its own —
 * see below for why that is worth the prop.
 *
 * One entry per column count in the grid ramp (2 → 3 → 4 → 5 → 6), and the two
 * have to be edited together. The 768–1024 band is the one that caught this
 * out: it read 33vw while the grid there had gone to more columns, so every
 * iPad was downloading an image about two-thirds wider than the box it was
 * painted into. See the breakpoint note in `InfiniteProducts`.
 *
 * Every entry is a `vw` now, including the last, and that is `--shell` going to
 * 100%. It was a fixed 240px while the shell was bounded, which was the honest
 * answer then: the grid stopped growing above the cap, so the box measured the
 * same on a 1800px laptop and a 2560px monitor and a `vw` would have
 * over-ordered on one and under-ordered on the other. Full-bleed reverses that
 * exactly — six columns of the whole window is ~16vw at any width, quoted at 17
 * to cover the gaps and the container padding, and a pixel value would now be
 * wrong everywhere except the one window it was measured on.
 */
const GRID_SIZES =
  "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 17vw, (max-width: 1720px) 14vw, 240px";

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
  /* The reduction as money rather than as a ratio — see the row itself for
     why the tile carries both. Guarded on `on_sale` through `discount` so a
     bad `regular_price` in WooCommerce cannot print a negative saving. */
  const saving =
    discount > 0 ? Math.max(0, product.regular_price - product.price) : 0;

  const soldOut = product.stock_status === "outofstock";
  const lowStock =
    !soldOut && product.stock_quantity !== null && product.stock_quantity <= LOW_STOCK_AT;

  // Readable URLs — /products/blue-running-shoes, not /products/190.
  const href = `/products/${product.slug || product.id}`;

  /* ---- The label chip ----
     The reference tile carries a small programme label — "Choice",
     "SuperDeals", "Brand+" — set INSIDE the title line rather than on a row of
     its own, and that placement is the whole reason it is affordable here. A
     chip row would be conditional, and a conditional row is a tile that is a
     different height from the one beside it, which is exactly what the fixed
     rows below exist to prevent. Riding in the title's two-line clamp it costs
     the tile no height at all, and a couple of characters of the name only on
     the products that carry one.

     Three labels, each earned from data this shop already has: `featured` is
     the shopkeeper's own pick, a reduction of 30% or more is a genuinely
     unusual one, and a 4.5 average over three or more reviews is the one
     signal on a tile that comes from other shoppers rather than from the shop.
     A chip on every tile is a chip that means nothing, which is what the
     thresholds are for — `TOP_RATED_AT` needs a real rating AND enough of
     them, because a single five-star review is not evidence of anything.

     The order is the order of usefulness to a shopper who has not decided yet:
     the shop's own pick, then a deep cut, then the crowd's verdict. */
  const topRated =
    product.rating_count >= TOP_RATED_REVIEWS && product.average_rating >= TOP_RATED_AT;

  /* Listed within the fortnight. `date_created` is nullable — a product whose
     date WooCommerce did not send is simply not new, rather than new since
     1970. */
  const listedAt = product.date_created ? Date.parse(product.date_created) : NaN;
  const isNew =
    Number.isFinite(listedAt) && Date.now() - listedAt < NEW_FOR_DAYS * 86_400_000;

  const chip = product.featured
    ? { label: "Choice", className: "bg-shop-ink text-white" }
    : discount >= 30
      ? { label: "Super Deal", className: "bg-shop-sale-price text-white" }
      : /* New sits above "Top rated" and below the two deal chips: a shopper
           who has been here before is looking for what changed, and a new
           listing has no rating yet to win the slot on anyway. */
        isNew
        ? { label: "New", className: "bg-shop-save text-white" }
        : topRated
          ? { label: "Top rated", className: "bg-shop-surface text-shop-ink" }
          : null;

  /* The ribbon on the photograph. "Selling fast" outranks the sales tiers
     because it is the only one of these words that is about right now: a
     product that has sold well AND is nearly out is the one case where the two
     facts together say something neither says alone. Below the lowest tier
     there is no ribbon at all — see `RIBBON_TIERS` for why that matters more
     than any of the words on it. */
  const ribbon =
    lowStock && product.total_sales >= 40
      ? "Selling fast"
      : (RIBBON_TIERS.find((tier) => product.total_sales >= tier.at)?.label ?? null);

  /* ---- Colour swatches ----
     The one variant a shopper judges from the grid. Sizes are not previewed —
     a size is checked once a product is wanted, on the page where it is chosen
     — but colour decides whether the product is wanted at all, and a tile that
     hides it sends the shopper into the PDP to find out the shot was the only
     colour there is.

     Two or more options, or nothing: a swatch row on a product that comes in
     one colour is a control that cannot be used.

     `option.value || option.name` matches `ColorSwatch` on the product page —
     sellers set either a hex or a plain colour word, and CSS takes both. */
  const colorOptions =
    product.attributes?.find((attribute) => attribute.name.toLowerCase() === "color")?.options ??
    [];
  const swatches = colorOptions.length > 1 ? colorOptions.slice(0, MAX_SWATCHES) : [];
  const extraSwatches = colorOptions.length - swatches.length;

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
    // ---- The white phone card is back, and the page tint with it ----
    //
    // Both halves of the argument above are live again, because both halves
    // moved together: the ground below 768px is #f9fafb once more (see the
    // `@media` block in `globals.css`), so a white card has something to be
    // white AGAINST, and the tile gets an edge from contrast rather than from a
    // border, a shadow or a wide gap — which is the cheap way to satisfy the
    // "exactly one separator" rule at the top of this file on a 390px screen
    // where space is the scarce thing.
    //
    // The card is also what puts the four text rows on the photograph's own
    // surface. Loose on the tint they belong to the page; on the card they
    // belong to the picture, which is the difference between a grid of objects
    // and a grid of pictures with words near them.
    //
    // `p-1.5` is 6px, and the radii are picked to match: a 12px outer corner
    // with 6px of padding wants a 6px inner corner, which is why the photo below
    // is `rounded-md` on a phone and keeps `rounded-lg` from md up. An inner
    // radius larger than (outer − padding) is what makes a card look like two
    // rectangles that missed each other.
    //
    // DESKTOP is untouched. Everything is `md:` reset, so from 768px up the tile
    // is the flat, chrome-free one the notes above describe — one component and
    // one set of rows, with four utilities between the two screens rather than a
    // second tile.
    //
    // ---- And the corners are gone, on both screens ----
    //
    // The two paragraphs above about concentric radii — a 12px outer corner
    // wanting a 6px inner one — described a real rule and there is nothing left
    // for it to govern: the phone card is square and so is the photograph
    // inside it, so the pair cannot disagree. They are kept because the rule is
    // what to reach for if a radius ever comes back, not because it is in force.
    //
    // The phone card itself stays. It is not decoration — it is the only thing
    // separating a tile from the #f9fafb page below 768px, per the argument
    // above — and a square white card on an off-white ground separates exactly
    // as well as a rounded one did.
    <article className="group relative flex h-full flex-col bg-white p-1.5 md:bg-transparent md:p-0">
      {/* ---- Image ---- */}
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          {/* Square, and back for good — the marketplace shape.

              This box has walked up the ratios: square → 8:9 → 5:6 → 3:4, each
              step argued as "the photograph is the tile, so give it the room".
              That argument is right about width and wrong about height. A
              taller box does not make the product bigger — `object-cover`
              fills the box either way, so at 3:4 the extra third of height was
              crop taken off a square supplier photograph, not product gained.
              What it did buy, reliably, was tile height: at seven columns the
              card ran ~100px taller than it needed to, and on a page whose job
              is to show a catalogue that is a row of products pushed off the
              screen.

              Every marketplace this grid competes with runs 1:1, and the
              reason is this catalogue's reason: supplier photography is
              square. A square source in a square box is untouched — no crop at
              all — which is most of these listings. The portrait shots a
              taller box was meant to serve give up about 13% of their height,
              taken evenly top and bottom, which a centred product shot has to
              give.

              No radius, on the photograph or the tile: the tiles run flat on a
              white page with the gap doing the separating (see the top of this
              file), and a rounded corner on a flat tile is a card outline with
              the card removed. `bg-shop-hairline` behind the image is what
              gives a product shot on white an edge without a border being
              drawn. The circular controls and the label chips keep their radii
              — they are objects ON the photograph rather than the
              photograph's own edge.

              `Skeletons.tsx` carries the same ratio and has to change with
              it. A placeholder at the wrong shape makes the grid visibly
              re-draw itself when the products land. */}
          <div className="relative aspect-square w-full overflow-hidden bg-shop-hairline">
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
             right, out of the subject of the shot, and only on products with a
             genuine reduction. It does not replace the figure beside the
             price; that stays, because the two do different jobs — this one
             stops the scroll, that one closes the sale.

             ---- The flag is brand orange, not sale red ----

             It was red, on the argument that red is the discount colour and
             orange is the brand, so red is the one that says "reduced". That
             held while red appeared nowhere else on a tile. It stopped holding
             once the tile carried a red flag, a red Super Deal chip and a red
             price all at once, on a page whose masthead, nav, buttons and
             promo bar are orange: two saturated colour families a few degrees
             apart, which reads as unresolved rather than as emphasis.

             `shop-primary-ink` rather than `shop-primary` is not a nicety.
             The palette note at the top of `globals.css` is explicit — white
             on #ff6a00 is 2.9:1 and fails AA at small sizes, and this label is
             11px. #b34a00 puts it at 5.9:1, which is better than the red it
             replaces managed (4.0:1). The whole deal language — this flag, the
             Super Deal chip and the discounted price — is now that one colour.

             ---- And it is red again, with the Super Deal chip ----

             The shopkeeper's call, and the reasoning above is not wrong so
             much as it is now outvoted by the thing it was protecting: a deal
             has to LOOK like a deal, and on a page whose masthead, buttons and
             promo bar are all orange, an orange discount flag is one more
             orange object rather than the loudest one. Red is the colour every
             marketplace in this market uses for a reduction, and it is the
             only hue on the tile that is not already spoken for by the brand.

             `shop-sale-price` rather than `shop-sale`: #dc2626 clears 4.8:1
             with white on it where the #e53935 error red manages 4.0:1, and
             this label is 11px. The deal language is now one token — this
             flag, the Super Deal chip and the discounted price are the same
             red, which is the part the old orange arrangement got right and
             worth keeping through the change.

             What that costs, stated plainly: red no longer means only "wrong"
             on a tile. The stock warning is red too, so a discounted product
             with two left carries red in three places. The stock line is the
             one that gives — it is 12px text with a dot, next to a bold chip
             and a bold flag, and if it stops reading as a warning it should
             move to near-black rather than the deal colour moving back. */}
        {!soldOut && discount > 0 && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-shop-sale-price px-1.5 py-[3px] text-[11px] font-bold leading-none text-white">
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

        {/* ---- The bestseller ribbon ----

            On the photograph, bottom left, opposite the cart button and clear
            of the discount flag in the top right.

            It is here rather than in the title's chip slot because the chip
            slot holds exactly one label and it is already spoken for on these
            products — a bestseller is very often also featured or discounted,
            so a fourth entry in that cascade would simply never render. The
            two positions also do different work: the chip is read with the
            name, this is read with the picture, which is the half of the tile a
            thumb flicking a rail actually sees.

            Near-black rather than orange. The deal language on a tile is brand
            orange — the corner flag, the Super Deal chip — and this is not a
            deal, it is what other shoppers did. A second orange object on the
            same photograph would read as another discount. */}
        {!soldOut && ribbon && (
          <span className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-56px)] truncate rounded-md bg-shop-ink/90 px-1.5 py-[3px] text-[11px] font-bold leading-none text-white backdrop-blur-sm">
            {ribbon}
          </span>
        )}

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
      {/* ---- Detail ----
           Three rows now, and only the first is guaranteed: the name, then
           corroboration where there is any, then the price.

           ---- What came out, and why the tile did not fall apart ----

           This block used to reserve a fixed height for EVERY row, including
           the ones with nothing in them, so that a product with no reviews
           rendered exactly as tall as one with plenty and a rail's tiles all
           matched. That reasoning was sound and the mechanism is no longer
           needed, because `mt-auto` on the price row does the same job better:
           the tiles in a grid row are already stretched to a common height, so
           pinning the price to the bottom edge lines the prices up whether or
           not the rows above them are there.

           With alignment paid for elsewhere, the empty boxes were just space —
           and space under a tile is what pushed the price down out of the
           first screen. Every row is conditional now and the block is as short
           as the product's own information.

           ---- The delivery line is gone ----

           "Fastest delivery: 1 business day" sat on every tile in the shop. A
           line that never varies is not information; it is a claim the shopper
           has read forty times by the second screen, and it was costing 16px
           on every tile to say nothing. The stock warnings it shared a row with
           DO vary, so they stay — but only on the products they apply to. */}
      <div className="flex flex-1 flex-col gap-0 pt-1.5">
        <Link href={href} className="block">
          {/* ---- One line, plain weight ----

              Two lines were reserved here so that a short name still held the
              second one and the price below it never moved. The price is
              bottom-pinned now, so the second line was buying nothing and
              costing 16px on every tile — and a truncated second line is where
              a supplier's keyword-stuffed title does its worst reading.

              The weight went 600 → 400 with the grid: a name is what confirms
              a match the photograph and the price already made, and forty
              semibold names on a screen is forty things competing with the
              prices under them. `.product-name` carries the family and weight
              — see `globals.css` for the full argument.

              `truncate` rather than `line-clamp-1`: on a single line they look
              identical, and `truncate` is one property that also guarantees the
              row cannot wrap in the first place. */}
          <h3 className="product-name truncate text-[13px] leading-[18px] text-shop-ink transition-colors hover:text-shop-primary">
            {chip && (
              <span
                className={`mr-1 inline-flex items-center rounded-[3px] px-1 text-[10px] font-bold leading-[15px] ${chip.className}`}
              >
                {chip.label}
              </span>
            )}
            {product.name}
          </h3>
        </Link>

        {/* The stock warning, on the products that have one and nowhere else. */}
        {(soldOut || lowStock) && (
          <p className="truncate text-[12px] font-medium leading-4 text-shop-sale">
            {soldOut ? (
              "Back in stock soon"
            ) : (
              <span className="inline-flex items-center gap-1.5 align-top">
                <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-shop-sale" aria-hidden />
                Only {product.stock_quantity} left
              </span>
            )}
          </p>
        )}

        {/* ---- The stock bar ----

            The same fact as the line above it, drawn instead of counted, and
            the pair is the point: "Only 2 left" is a number a shopper has to
            weigh against nothing, and a bar two-fifths full is a quantity they
            read without stopping. Every marketplace this shop competes with
            runs one, and this is the one urgency device on the tile that is
            not a claim — it is `stock_quantity` out of the threshold that put
            the warning there, so a bar can never say "nearly gone" about a
            product with plenty in the back.

            It is honest about its scale, which is the part that is usually
            faked. The full width is `LOW_STOCK_AT`, not some invented
            starting stock: the bar begins at the moment the product becomes
            scarce and empties from there, so five left is a full bar and one
            left is a fifth. Nothing here is ever drawn from a figure the shop
            does not have. */}
        {lowStock && product.stock_quantity !== null && (
          <span
            aria-hidden
            className="mt-0.5 block h-[3px] w-full max-w-[90px] overflow-hidden bg-shop-hairline"
          >
            <span
              className="block h-full bg-shop-sale"
              style={{ width: `${Math.max(12, (product.stock_quantity / LOW_STOCK_AT) * 100)}%` }}
            />
          </span>
        )}

        {/* Rating and units sold — the two numbers a shopper uses to decide
            whether anyone else has taken the risk first.

            The sold count leads and the stars follow, which is the reference's
            order and the right one here: sales are the number nearly every
            product has, and a rating is the one most of this catalogue is still
            missing, so leading with the stars left a row that began with a gap
            on the majority of tiles.

            `leading-none` keeps the row to its text: 12px copy at `.meta-note`'s
            1.3 leading would otherwise open a 15.6px box under a tile that is
            trying to be short. */}
        {(product.total_sales > 0 || product.rating_count > 0 || product.seller) && (
          <div className="flex items-center gap-x-2 overflow-hidden py-[3px]">
            {product.total_sales > 0 && (
              <span className="meta-note shrink-0 leading-none text-shop-muted">
                {compactSold(product.total_sales)} sold
              </span>
            )}
            {product.rating_count > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                <Stars rating={product.average_rating} />
                <span className="meta-note leading-none text-shop-body">
                  {product.average_rating.toFixed(1)}
                </span>
              </span>
            )}
            {/* ---- Who is selling it ----
                This is a marketplace: the tiles in one grid come from different
                shops, and on every other marketplace the store name is the
                thing a shopper uses to decide whether to trust a listing they
                know nothing else about. It was the one fact on the tile that
                the shop had and never showed.

                It rides the meta row rather than taking one of its own, so on
                the tiles that already show sales or a rating it costs no
                height at all — and it is the item that gives way when the row
                runs out of width, because a store name is context for the two
                numbers beside it rather than a rival to them.

                Hidden below `sm`: a 150px phone tile fits "2.2K sold" and five
                stars and nothing more, and a store name squeezed to four
                characters and an ellipsis identifies nobody.

                Its own link, not the tile's — tapping the store should go to
                the store. `relative z-10` keeps it above nothing in
                particular today, but the tile has had an overlay link before
                and this is the guard against the next one swallowing it. */}
            {product.seller?.store_slug && (
              <Link
                href={`/sellers/${product.seller.store_slug}`}
                className="meta-note relative z-10 ml-auto hidden min-w-0 truncate leading-none text-shop-muted transition-colors hover:text-shop-primary sm:block"
              >
                {product.seller.store_name}
              </Link>
            )}
          </div>
        )}

        {/* The colours it comes in, when it comes in more than one. Dots rather
            than the names: at 12px "Charcoal / Off-white / Sand" is unreadable
            and the colour itself is the label.

            `aria-hidden` on the dots with the names in one visually-hidden
            string beside them — five unlabelled circles are noise to a screen
            reader, and the useful form of this row is the sentence, not the
            swatches. Not interactive here: choosing happens on the product
            page, and a tile that let a colour be picked would be promising a
            preview it cannot show. */}
        {swatches.length > 0 && (
          <div className="flex items-center gap-1 py-[3px]">
            <span className="sr-only">
              Colours: {colorOptions.map((option) => option.name).join(", ")}
            </span>
            {swatches.map((option) => (
              <span
                key={option.name}
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: option.value || option.name.toLowerCase() }}
              />
            ))}
            {extraSwatches > 0 && (
              <span aria-hidden className="meta-note leading-none text-shop-muted">
                +{extraSwatches}
              </span>
            )}
          </div>
        )}

        {/* Free delivery, on the items that clear the threshold on their own.

            Above the money block rather than inside it, deliberately: the block
            below is bottom-pinned by `mt-auto` so that every price in a grid
            row lands on the same line, and a row rendered underneath the price
            would lift it off that line on some tiles and not others. Everything
            above the pin flows from the top and can appear and disappear
            freely, which is where a conditional row belongs. */}
        {!soldOut && <TileFreeDelivery price={product.price} />}

        {/* ---- The money, and the last thing in the tile ----

             All on one line: what it costs, what it cost, and the reduction. A
             discounted price turns red — the one place red is allowed — because
             at a glance the colour is the discount.

             `mt-auto` is what holds the grid together now that every row above
             it can be absent. A grid row stretches its tiles to a common
             height, so pinning the price to the bottom of each one puts all the
             prices in a row on the same line — which is the alignment the fixed
             row heights used to buy, at no cost in space.

             The size and weight live in `.price` and `.was-price` — the shop's
             type scale — so a tile cannot drift away from the product page.

             ---- Why the struck-through original disappears below `sm` ----

             On a 382px phone showing 2.5 tiles a tile is about 150px wide, and
             the three figures — "UGX 120,000  UGX 300,000  −10%" — need roughly
             double that. `whitespace-nowrap` stops a price ever breaking
             mid-number, and below `sm` the original and the percentage are
             dropped rather than squeezed: the discount is already on the
             photograph as a corner flag, so nothing is lost and the resting
             price gets the whole width to itself. */}
        {/* ---- What the shopper keeps, in money ----

             A reduction is on the tile twice already — the corner flag says
             "−35%" and the struck-through original says what it was — and both
             of those are ratios a shopper has to do arithmetic on. This is the
             same fact as the number they would arrive at: what stays in their
             pocket.

             It is the row worth adding because a percentage is a comparison
             and a sum is a decision. "−35%" is read against other tiles;
             "Save UGX 19,000" is read against what else that money buys, which
             is the thought that ends in a purchase.

             Only on discounted tiles, so it costs nothing on the rest — and it
             sits ABOVE the price rather than in it, because that row is
             `overflow-hidden` and a third figure inside it is what produced
             the sliced "−(" the percentage was removed for.

             Green, and it is the only green in the grid. The price below is
             red and the corner flag and chip are orange, so this row is the
             one place on a tile where a third hue is doing work rather than
             decorating: red is what it costs, green is what it saves. That
             pairing is the oldest one in retail and it needs no explaining.

             `shop-save` rather than `shop-success` — 11px bold needs the
             darker step to clear AA. See the token in `globals.css`. */}
        {saving > 0 && (
          <p className="mt-auto truncate pt-[3px] text-[11px] font-bold leading-4 text-shop-save">
            Save {formatPrice(saving)}
          </p>
        )}
        <p
          className={`flex items-baseline gap-x-1.5 overflow-hidden pt-[3px] ${
            saving > 0 ? "" : "mt-auto"
          }`}
        >
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
               price, so the grid and the PDP agree.

               ---- A reduced price is RED ----

               The argument above is about the RESTING price and it is
               untouched: forty orange numbers would still be a second colour
               field, so a price with no reduction behind it stays near-black.

               A reduced price is the other case. Only some tiles carry one, so
               it is the exception on the page rather than a colour field, and
               that is the condition under which a colour reads as information.
               Red is the colour every marketplace this shop competes with uses
               for it, and a shopper does not have to learn it.

               This went orange for a while, on the argument that a tile
               carrying a red flag, a red chip and a red price on an orange
               site was running two colour families at once. That is a real
               risk and the answer is to ration the OTHER two — the corner flag
               and the Super Deal chip are brand orange, so the red on a tile
               is the price and nothing else.

               `shop-sale-price` is #dc2626 rather than the #e53935 the shop
               uses for errors: a price is small text (15px at 800 is not
               "large" under WCAG), #e53935 is 4.2:1 on white and this clears
               4.8:1. The two reds being separate tokens is also what keeps
               "reduced" and "something went wrong" from sharing a colour. */}
          <span
            className={`price whitespace-nowrap ${
              discount > 0 ? "text-shop-sale-price" : "text-shop-ink"
            }`}
          >
            {formatPrice(product.price)}
          </span>
          {/* ---- The struck-through original, and NOT the percentage ----

               The row carried "UGX 145,000  UGX 160,000  −9%" and the third
               figure was being cut in half: the row is `overflow-hidden` to
               keep the tile's height honest, and three figures need about
               double the width of a tile in a six-column grid. What a shopper
               saw was a sliced "−(".

               The percentage is the one that goes, because it is the only thing
               in the tile said twice — the corner flag on the photograph is the
               same number, in the same red, where it is read first. Dropping it
               here costs no information and gives the two figures that ARE
               distinct the whole width.

               The original still disappears below `sm`, where a 150px phone
               tile has room for one price and nothing else. */}
          {discount > 0 && (
            <span className="was-price hidden whitespace-nowrap sm:inline">
              {formatPrice(product.regular_price)}
            </span>
          )}
        </p>
      </div>
    </article>
  );
}
