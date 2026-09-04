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

/**
 * Whether a product was listed recently enough to wear the "New" chip.
 *
 * ---- Why this is a function and not two lines in the component ----
 *
 * It used to read the clock in the middle of the render body, and React's
 * linter is right to object even though this is a server component. A component
 * body is meant to be a pure function of its props: given the same product it
 * should produce the same tile. `Date.now()` breaks that, and the consequence
 * is not theoretical — a tile that renders on one side of the fourteen-day
 * boundary and re-renders on the other changes without its props having changed,
 * which is precisely the class of bug the rule exists to catch.
 *
 * Pulled out here, the impurity is named, confined to one place, and obviously
 * time-dependent to anyone reading the call. The clock is still read — a
 * freshness badge cannot be computed without it — but the component no longer
 * pretends to be pure while doing it.
 *
 * `date_created` is nullable: a product whose date WooCommerce did not send is
 * simply not new, rather than new since 1970.
 */
function listedRecently(dateCreated: string | null | undefined): boolean {
  if (!dateCreated) return false;
  const listedAt = Date.parse(dateCreated);
  return Number.isFinite(listedAt) && Date.now() - listedAt < NEW_FOR_DAYS * 86_400_000;
}

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
  // One entry per column count in the ramp, and they have to stay in step
  // with it — a `sizes` string that disagrees with the grid is how a page
  // silently downloads tablet-width photographs for thumbnails.
  //
  //   ≤768   3 cols  33vw
  //   ≤1024  4       25vw
  //   ≤1536  5       20vw
  //   ≤1720  6       17vw
  //   above  6       275px, once the shell stops growing
  //
  // The 1280 band is gone: it used to be the 5→6 step and the step is at 1536
  // now. A breakpoint that changes nothing is a breakpoint that will be read as
  // meaning something later.
  //
  // Six columns of a bounded 1720px shell is a 275px tile: (1720 − 64px of
  // container padding − five 1px hairlines) ÷ 6. The gutters are hairlines
  // rather than gaps now, so they no longer round to anything worth carrying
  // through this arithmetic.
  "(max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1536px) 20vw, (max-width: 1720px) 17vw, 275px";

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
  const isNew = listedRecently(product.date_created);

  /* ---- The Super Deal chip is yellow, and it had to become something ----
   *
   * It was `bg-shop-sale-price text-white`, which was a red chip and a good
   * one: the deal chip and the reduced price beneath it were the same red, so
   * the tile said one thing twice in one colour.
   *
   * Then red came out of the palette. `shop-sale-price` resolves to ink now, so
   * this chip quietly became a black chip with white text — which is character
   * for character what the "Choice" chip above it already is. Two labels
   * meaning different things, drawn identically, on tiles sitting next to each
   * other in the same grid. Nothing errored and nothing looked broken; the
   * distinction just stopped existing.
   *
   * Yellow is the answer that was already in the shop. `bfl-yellow` is the
   * ground under the Super Deals shelf further down the page, so the chip on a
   * tile and the section that collects those tiles now carry the same colour —
   * which is the association the red version had with the price, moved to
   * where it is still true.
   *
   * Ink type on it, not white: black on #facc15 is 11:1, white on it is 1.6:1
   * and illegible. A yellow chip is the one case in this file where the label
   * colour has to flip, and it is why this is not just a background swap.
   *
   * ---- All four chips are soft tints now ----
   *
   * The history above is four rounds of asking which SATURATED fill each chip
   * should take, and every round produced a filled block with reversed type —
   * a black "Choice", a white-on-green "New", a yellow "Super Deal" — sitting
   * inside the first line of the product's name. On a page of white cards on
   * cream those blocks are the heaviest ink on the screen, and they are heaviest
   * on exactly the tiles a shopper is meant to find inviting.
   *
   * Each chip now takes the soft tint of its own hue with that hue's dark step
   * as the type: orange for the deal, green for new, blue for top rated, violet
   * for the shop's own pick. Every pair is a `*-soft` ground with a `pop-*` or
   * `shop-*` ink from the same family, and all four clear AA — 4.9:1 for the
   * orange, 4.8:1 for the green, 6.2:1 for the violet, 5.8:1 for the blue —
   * which is what this 9.5px label needs and all it needs. The yellow chip's
   * 11:1 was buying nothing above that, and it was buying it with a block.
   *
   * The four stay distinguishable, which was the real point of the round above:
   * they differ by HUE now rather than by fill, so "Choice" and "Super Deal" can
   * never collapse into the same black rectangle again the way they did when a
   * token was retired underneath them. */
  const chip = product.featured
    ? { label: "Choice", className: "bg-pop-violet-soft text-pop-violet" }
    : discount >= 30
      ? /* Red, where this was the brand orange. It is the only one of the four
           chips that is about the PRICE, and the price marks on this tile — the
           corner percentage and the reduced figure — are red; an orange deal
           chip beside a red percentage was the tile saying one thing in two
           voices. The other three chips keep their own hues, which is what
           stops the row of them collapsing into one colour again. */
        { label: "Super Deal", className: "bg-shop-price-was-soft text-[color:var(--color-shop-price-was)]" }
      : /* New sits above "Top rated" and below the two deal chips: a shopper
           who has been here before is looking for what changed, and a new
           listing has no rating yet to win the slot on anyway. */
        isNew
        ? { label: "New", className: "bg-pop-green-soft text-shop-save" }
        : topRated
          ? { label: "Top rated", className: "bg-pop-blue-soft text-pop-blue" }
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

  /* ---- Which shape this tile's photograph is cut to ----
   *
   * One of three frames, and it only means anything on a phone: below 640px
   * the product grid is CSS columns rather than a grid, and a masonry column
   * is only staggered if its cells are different heights. From `sm` up all
   * three classes resolve to the same 8:9 and the grid is ruled again. See
   * `.tile-frame` in globals.css and the note in lib/product-grid.ts.
   *
   * `id % 3` rather than anything random, and that is the whole reason this is
   * a modulo of a number the product already has: the server and the browser
   * have to choose the same frame or hydration mismatches and the entire grid
   * re-lays-out on load. `Math.abs` because a Woo id is not guaranteed
   * positive and `%` in JavaScript keeps the sign. */
  const frame = ["tile-frame-a", "tile-frame-b", "tile-frame-c"][
    Math.abs(product.id) % 3
  ];

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
    /* ---- One tile at every width, for the first time ----

       This carried two designs and a breakpoint between them: below `md` a
       white card with a hairline ring and 4px of padding, from `md` up a
       transparent block with none of that. The card existed because the phone
       page ground was off-white and a borderless tile on it had nothing to sit
       on; the transparent block existed because the desktop page ground was
       white and a white card on white draws a rectangle nobody can see.

       Both were correct answers to a question that no longer has two forms. The
       page is a canvas with white PANELS on it now (see `.shop-panel` in
       globals.css), and a tile stands on panel white at every width — so the
       phone case and the desktop case became the same case, and the card was
       drawing a second edge inside an edge the panel had already drawn.

       What replaces the card is a hover state rather than a resting one, which
       is the trade this whole file has been circling: a grid of forty tiles
       does not need forty boxes at rest, it needs to show which one the pointer
       is on. That lives on the photograph below — a soft lift — so nothing in
       the layout moves and the grid cannot be knocked out of alignment by a
       hover.

       `h-full` stays. A grid row stretches its tiles to a common height and the
       price is bottom-pinned against that, so the tile has to actually fill the
       row for the pinning to line anything up.

       ---- And the card is back, at every width this time ----

       Everything above was right about ONE tile at every width and wrong about
       which one. It chose the transparent block because a white card on a white
       panel draws a rectangle nobody can see — which was true, and was a fact
       about the PAGE rather than about the tile.

       The page moved. The canvas is a warm cream now (see the `--color-shop-
       canvas` note in globals.css), the grids that carry most of this shop's
       traffic — /search, /category, the endless homepage feed — lay their tiles
       straight onto it with no panel underneath, and a chrome-free tile there
       is a photograph on cream with four rows of loose text below it. So the
       card is real again: it is what puts the name, the price, the rating and
       the delivery line on the photograph's own surface instead of on the page.

       It is `.tile-card`, one class in globals.css, rather than a string of
       utilities repeated here — the tile appears in six grids and three
       carousels, and a hover lift that disagrees between them is the sort of
       thing nobody can name and everybody feels.

       The hover moved with it, from the photograph to the whole card. The
       argument above for putting it on the photo was that a lift on a chrome-
       free tile has nothing to lift; a card does, and lifting the card rather
       than the picture inside it is what makes the tile read as one object. The
       padding is the only thing the two screens still disagree about: 6px on a
       phone where 2.5 tiles share the glass, 8px from `md`. */
    /* `p-1.5` at every width, where this was `md:p-2`. The padding is the only
       thing between the photograph and the card's own edge, so on a desktop it
       was eight pixels a side taken off the picture to produce a margin nobody
       was looking at — the card's hairline already does the separating. Two
       pixels back on each edge is four pixels of image across every tile. */
    /* `p-1` on a phone, where the grid is three across and a tile is about
       120px: 6px of padding on each side is a tenth of the tile spent on air
       around a photograph that is already small. Back to 6px from `sm` up,
       where there is width to give it. */
    <article className="tile-card group relative flex h-full flex-col p-1 sm:p-1.5">
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

              ---- 8px corners, back on the photograph ----

              They were taken off on the argument that a rounded corner on a
              flat tile is a card outline with the card removed. That holds for
              the TILE, which still has none — nothing here draws a card edge
              from md up. It does not hold for the photograph, which is not an
              outline but an object: it has its own `bg-shop-hairline` ground
              and its own hard edge against the page, and a square photo edge
              on a borderless tile reads as a sharp-cornered sticker rather
              than as merchandise.

              8px, `rounded-lg`, the same figure the buttons and chips use, so
              the shop has one radius rather than a scale of them. Cheap in
              pixels too: `object-cover` on a rounded box clips four small
              bites out of the picture, and at 8px on a ~250px tile that is the
              outermost corner of a product shot photographed on white — which
              is to say, the white.

              The circular controls and the label chips keep their own radii.
              They are objects ON the photograph rather than the photograph's
              own edge.

              `Skeletons.tsx` carries the same ratio and has to change with
              it. A placeholder at the wrong shape makes the grid visibly
              re-draw itself when the products land. */}
          {/* ---- A true square, and a corner to match the panel ----

              The ratio walked square → 8:9 → 5:6 → 3:4 and back to 1/1.05, and
              the note above records why: `object-cover` fills the box either
              way, so height taken past square is crop off a square supplier
              photograph rather than product gained. 1/1.05 was that argument
              arriving *nearly* at its own conclusion — a 5% tail left over from
              the walk back, costing every tile in the shop five percent of its
              height to no end. It is 1:1 now, which is what the reasoning said
              and what the supplier photography actually is.

              12px corners rather than 8. The tile no longer draws a card, so
              the photograph IS the tile's shape, and it now sits inside a panel
              with a 16px corner — a 12px picture inside a 16px sheet reads as
              nested; an 8px picture inside it reads as a slightly wrong
              rectangle that happened to land there. One radius scale, stepping
              down as the objects nest: panel 16, photograph 12, chips 6.

              ---- The hover lift, which replaced the resting card ----

              A shadow only while the pointer is on the tile. At rest the grid
              is flat — forty boxes with forty shadows is the haze this shop has
              refused everywhere else — and on hover the photograph rises off
              the panel just enough to say which tile is live.

              It is drawn on the PHOTOGRAPH and not on the article, which is the
              part that matters: the article is a grid item, and a shadow or a
              transform on it would either be clipped by the grid gap or shift
              the text under it. The picture is an absolutely-sized box inside
              that item, so it can lift without moving anything.

              The ring is 4% ink rather than `shop-line`. A photograph shot on
              white needs its own edge against a white panel, but at the full
              hairline weight forty of them read as a wireframe; 4% is the
              lightest edge that still closes the shape.

              `Skeletons.tsx` carries this ratio and radius and has to change
              with it — a placeholder at the wrong shape makes the grid visibly
              re-draw itself when the products land. */}
          {/* ---- The page and this box are never the same colour ----

              That is the whole rule, and it has now been got wrong in both
              directions, so it is worth stating once rather than re-deriving:

                page tinted + box white  →  the tile reads as a card
                page white  + box tinted →  the tile reads as a card
                both the same            →  the product floats with no edge,
                                            and a grid of them is a field of
                                            cut-out objects rather than a grid

              The page is white, so the box carries the shape. `shop-hairline`
              is a 4% neutral — enough to draw the tile, not enough to read as a
              grey rectangle behind a photograph shot on white. It is what the
              reference does on its own white page. */}
          {/* ---- 5:6, not 1:1 ----

               A square is the safe ratio and it is not the flattering one for
               most of this catalogue: duvet sets, mosquito nets, jackets and
               shoes are all taller than they are wide, so a square frame spent
               its width on the room around the product.

               8:9 now, having been 5:6 and then 6:7 on the way. Each step is
               the same trade read from a different distance: taller flatters
               portrait stock, shorter fits more rows on a screen. At a ninth
               taller than square the frame still does the first — a duvet or a
               jacket is not cropped to its middle — while a grid row costs
               about fifteen pixels less, which compounds down a page of forty
               products.

               The columns do not move at any of these. Only the height changes,
               so nothing else in the grid has to be re-reasoned.

               `object-cover` still crops, and now crops the sides rather than
               the top and bottom, which for portrait stock is the crop that
               keeps the subject. Anything genuinely landscape loses a little at
               the edges, which is the trade; the alternative is letterboxing
               every portrait shot to suit a minority of the catalogue. */}
          {/* Square, with the tile. A 10px-rounded photograph inside a
              square cell reads as a picture pasted onto the card rather than
              as the card's own face — and the cell is the object now, not the
              picture inside it. See `.tile-card` in globals.css. */}
          <div
            className={`tile-frame ${frame} relative w-full overflow-hidden bg-shop-photo`}
          >
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
                  quality={90}
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
                    quality={90}
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
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold leading-none text-shop-body ring-1 ring-shop-line backdrop-blur-sm">
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
             this label is 11px.

             ---- Yellow, with the chip ----

             The deal language was one token: this flag, the Super Deal chip and
             the discounted price were all the same red, which is the part the
             old orange arrangement got right. Red then came out of the palette
             entirely, `shop-sale-price` resolved to ink, and the flag became a
             black box in the corner of every reduced photograph — heavier than
             anything else on the tile, for the least important thing on it.

             It is `bfl-yellow` now, which is where the deal language went: the
             Super Deal chip, the Super Deals shelf and this flag are one hue
             again. Ink type on it rather than white, for the same reason as the
             chip — black on #facc15 is 11:1 and white on it is 1.6:1.

             It also solves the collision the old note worried about. Red used
             to mean both "reduced" and "nearly gone", so a discounted product
             with two left carried it in three places; yellow means the deal and
             nothing else, and the stock line keeps its own voice. */}
        {!soldOut && discount > 0 && (
          /* ---- And the deal language came back to orange ----

             The note above is the full history: red, then orange, then yellow.
             Yellow won on the argument that orange was "one more orange object"
             on an orange page — which was decided when the tile had no card and
             the flag was the only thing drawn on a bare photograph.

             The tile is a white card on a cream page now, and yellow lost the
             argument on sight: #facc15 next to #ff6a00, on a warm ground, is two
             saturated warm hues a few degrees apart, which is the one pairing
             that reads as an accident rather than as a system. Four of those in
             a row is what made the old homepage look cluttered rather than
             cheap. One warm hue, used for the brand AND for the deal, is fewer
             things to learn and a calmer page.

             Ink type on the orange rather than white, and that part is not
             taste: white on #ff6a00 is 2.9:1 and this label is 11px, where
             near-black on it is 6.0:1. It also happens to look better — a dark
             number on a bright chip is what a price sticker looks like.

             The shape stays as the note above describes it: a pill, 800 weight,
             a hair of padding, and a warm shadow so it lifts off the photograph
             rather than sitting flat on it.

             ---- 2026-09-04: red, and this time it is the last round ----

             The shopkeeper's call again, and the history above is five rounds
             of the same question — red, orange, yellow, orange — asked once per
             mark. What ended it is not a better hue but a single token: every
             percentage and every reduced price in the shop now resolves to
             `--color-shop-price-was` (see its note in globals.css), so the
             corner flag, the mini tile's flag, the −x% on the product
             photograph, the "Save x%" chip and the price itself cannot drift
             apart again the way they did each time one of them was repointed.

             White type rather than the ink this carried on orange: white on
             #c62828 is 5.5:1 where near-black is 3.9:1, so the polarity flips
             back with the ground. That is the same trade the yellow round made
             in the opposite direction, and it is why a fill change here is
             never only a fill change. */
          /* Smaller and tighter into the corner on a phone. The grid runs three
             across there, so a tile is about 120px on a 360px screen and the
             flag was sized when it was 165px — at 11px with 8px of padding it
             covered a fifth of the photograph. 9.5px in the corner says the
             same number and leaves the picture visible, which on a tile this
             small is the only thing doing any selling. */
          <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-[color:var(--color-shop-price-was)] px-1.5 py-0.5 text-[9.5px] font-extrabold leading-none text-white shadow-[0_4px_10px_-4px_rgba(198,40,40,0.85)] sm:right-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[11px]">
            −{discount}%
          </span>
        )}

        {/* The reference card carries no heart, so it appears on hover — and on
            focus, so it stays reachable from the keyboard. Wishlisting is real
            functionality here; hiding it entirely would remove a feature to
            match a screenshot. */}
        {/* `z-20` to sit above the whole-card link added at the foot of this
            component. Without it the overlay swallows the click and wishlisting
            a product navigates to it instead. */}
        <div className="absolute left-2 top-2 z-20 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
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
          /* `rounded-lg` and a touch more padding, in step with the discount
             flag in the opposite corner. The two are the only marks on a
             resting photograph and they are read as a pair — one saying what
             the shop has done to the price, one saying what other shoppers
             have done about it — so a shape shared between them is what stops
             the picture looking like it collected two unrelated stickers. */
          <span className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-56px)] truncate rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold leading-none text-shop-primary-ink ring-1 ring-shop-primary/15 backdrop-blur-sm">
            {ribbon}
          </span>
        )}

        {/* Add-to-bag rides the corner of the photograph rather than sitting in
            the text below it. It buys back a whole line of the tile, and it is
            where a thumb already is after tapping the picture. */}
        {/* Ringed rather than shadowed, for the reason on the wishlist button
            above: a white disc on a white product shot needs a drawn edge. */}
        {/* `z-20`, above the whole-card link — see the wishlist note. Adding to
            the basket from a tile must not be a navigation. */}
        <div className="absolute bottom-2 right-2 z-20 rounded-full bg-white/95 ring-1 ring-black/5 backdrop-blur-sm">
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
      {/* ---- The rows were each buying their own air, and it added up ----

           `pt-1.5` under the photograph, `py-[3px]` on the meta row, another
           `py-[3px]` on the swatches, `pt-[3px]` on the free-delivery line:
           each of those is defensible on its own and together they were up to
           15px of padding inside a block whose entire content is four rows of
           11–13px type. Worse, the total DIFFERED per tile, because which rows
           appear depends on the product — so the vertical distance from the
           photograph to the price was a different number on almost every tile
           in the grid, which is exactly the raggedness this was asked to fix.

           They are `py-px` and `pt-px` now, and the block leans on the rows'
           own `leading-*` for its rhythm instead. Leading is per-row and
           uniform by construction; padding stacked on top of it is not. */}
      {/* `pt-2`, up from `pt-1`. The photograph gained a hover lift and a
          12px corner and lost the card that used to box it, so the gap between
          it and the first line of the name is now the only thing separating the
          picture from the copy — at 4px the name read as a caption stuck to the
          bottom edge of the image. 8px is the figure the rest of the page uses
          between an object and its label. */}
      <div className="flex flex-1 flex-col gap-0 pt-1.5">
        <Link href={href} className="block">
          {/* ---- Two lines, plain weight, and a fixed box ----

              This was one truncated line, and the argument for that is kept
              below because it was sound about the thing it was measuring. What
              it got wrong is what a truncated line does to a real catalogue:
              these names arrive from suppliers at forty to eighty characters —
              "STY Men Cross-body Bag + Wallet + A Free Gift Set- Black" — and
              one line at this width shows about the first twenty of them. A
              row of tiles all reading "2 Pack Of Men's Faux Leather…" is a grid
              a shopper cannot tell apart without opening things, which is the
              one job the name has.

              Two lines is what the marketplaces this grid is modelled on all
              use, and it is the point at which a supplier title has said which
              product it is. Three would start showing the keyword stuffing.

              `min-h-[36px]` is the load-bearing half. `line-clamp-2` is a
              ceiling, not a height, so a one-line name would leave its tile
              16px shorter than its neighbours and the prices in a row would
              land on two different lines — the exact misalignment the old
              single line was reserving space to avoid. The box is fixed at both
              ends instead: 2 × 18px leading, whether the name fills it or not.

              The weight goes back to 600 with the second line, and the two
              changes belong together: a two-line block at 400 reads as a
              paragraph under a photograph, where the same two lines at 600 read
              as one object with a name. `.product-name` carries the family and
              the weight — it is unlayered, so it beats a `font-*` utility here
              and `globals.css` is the only place that number can be changed.

              ---- The earlier argument, for one line, kept ----

              "Two lines were reserved here so that a short name still held the
              second one and the price below it never moved. The price is
              bottom-pinned now, so the second line was buying nothing and
              costing 16px on every tile — and a truncated second line is where
              a supplier's keyword-stuffed title does its worst reading."

              The 16px is real and it is what this change spends. It buys the
              difference between a grid of distinguishable products and a grid
              of identical prefixes. */}
          {/* 2 x 17px rather than 2 x 18px. The box has to stay fixed at both
              ends — a one-line name in a flexible box drops its tile and lands
              the prices in a row on two different lines — so the saving comes
              from the leading rather than from the line count. 17px on 13px
              type is still a comfortable 1.31, and it is two pixels off every
              tile in the grid. */}
          {/* ---- Small, and set at a normal weight ----

              12px on 16px leading, down from 13/17, and `.product-name` now
              carries `font-weight: 400` rather than 600. The name is the one
              thing on this tile that is not a claim: the price, the saving and
              the stock line are all set in bold or in colour because they are
              the numbers a shopper is comparing, and a semibold name was
              competing with all three at once for the same attention.

              At 400 the name reads as the caption under the photograph, which
              is what it is — the photograph says what the product looks like
              and the name says which one it is. The weight that was carrying
              "one object with a name" is now carried by the tile's own edges,
              which the flush sheet draws around every cell.

              `min-h-[32px]` is still 2 × the leading, and it is still
              load-bearing for the same reason as before: `line-clamp-2` is a
              ceiling rather than a height, so without it a one-line name would
              land its price on a different row from its neighbours'. */}
          <h3 className="product-name line-clamp-2 min-h-[32px] text-[12px] leading-[16px] text-shop-ink transition-colors hover:text-shop-primary">
            {chip && (
              <span
                className={`mr-1 inline-flex items-center rounded-[3px] px-1 text-[9.5px] font-bold leading-[14px] ${chip.className}`}
              >
                {chip.label}
              </span>
            )}
            {product.name}
          </h3>
        </Link>

        {/* ---- The price comes straight after the name ----

           It used to be the LAST thing in the block, pinned to the bottom of
           the tile with `mt-auto` so that every price in a grid row landed on
           the same line. That is a real property and it is not free: it means
           the gap between the name and the price is however much the tile has
           left over, so on a product with no rating, no swatches and no
           delivery line the two sat an inch apart with nothing between them —
           and the shopper's eye had to cross that gap on every tile.

           Name then price, touching, is what every marketplace this shop is
           measured against does, and the reason is that they are one thought:
           what it is, what it costs. Everything else on the tile — who else
           bought it, what colours it comes in, how fast it arrives — is
           evidence for a decision those two lines have already framed, so it
           belongs after them.

           The alignment that `mt-auto` bought is given up deliberately. It only
           ever paid off on a row of tiles whose text blocks happened to differ,
           and the price of it was a hole in every sparse tile in the grid. */}

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
          <p className="pt-[3px]">
            {/* ---- Green again, and this time it is drawn rather than asserted ----

                The note above spends a paragraph on why this row is green —
                "red is what it costs, green is what it saves, the oldest
                pairing in retail" — and then set it in `text-shop-muted`,
                which is the grey used for sold counts and secondary labels.
                The reasoning and the class had drifted apart, so the one line
                on the tile that was supposed to be the reward read as
                small print.

                It is a chip rather than coloured text because the row it sits
                in is otherwise all greys and the saving is competing with a
                price directly below it at 13px/700. `shop-successbg` is the
                palest green in the palette and `shop-save` is the 4.6:1 step
                that clears AA at this size — the same pair the trust ribbon
                uses, so the shop has one green rather than a family of them.

                It stays off the price row itself. That row is
                `overflow-hidden` to keep tile heights honest, and a third
                figure inside it is what produced the sliced "−(" the
                percentage was removed for. */}
            <span className="inline-block max-w-full truncate rounded-md bg-shop-successbg px-1.5 py-[2px] text-[10.5px] font-bold leading-[15px] text-shop-save">
              Save {formatPrice(saving)}
            </span>
          </p>
        )}
        <p className="flex items-baseline gap-x-1.5 overflow-hidden pt-px">
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

               ---- And now every price is ink, reduced or not ----

               That whole argument was about WHICH red a reduced price should
               take. There is no red in the palette any more, so the question
               dissolved: `shop-sale-price` resolves to ink, which is what a
               resting price was already set in, and the ternary that chose
               between them was choosing between one colour and itself.

               Removed rather than left as a no-op. A conditional whose branches
               are identical is worse than no conditional: it reads as a
               distinction the tile is still making, and the next person to
               touch this row would spend time working out why it appears not to
               work.

               Nothing is lost. "Reduced" is still said three times on the tile
               — the orange corner flag, the struck-through original beside this
               number, and the "Save UGX x" line under it — and none of those
               ever depended on the price's own colour. */}
          {/* Red when it is a reduction, ink when it is just the price.

               An earlier pass removed a ternary here because both of its
               branches resolved to ink — a distinction the tile appeared to be
               making and was not. The distinction is real again: a reduced
               price is set in the price-was red beside its struck original,
               which is the oldest price-tag convention there is and the one
               shoppers read without being taught. A resting price stays ink,
               so the red still means something when it appears. */}
          <span
            className={`price whitespace-nowrap ${
              discount > 0 ? "text-[color:var(--color-shop-price-was)]" : "text-shop-ink"
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

        {/* The corroboration, under the two lines that matter. */}

        {/* The stock warning, on the products that have one and nowhere else. */}
        {(soldOut || lowStock) && (
          <p className="truncate text-[11px] font-medium leading-[15px] text-shop-body">
            {soldOut ? (
              "Back in stock soon"
            ) : (
              <span className="inline-flex items-center gap-1.5 align-top">
                {/* ---- Orange, where the dot and the bar below were ink ----

                    `shop-sale` resolved to #111827 when red came out of the
                    palette, so the scarcity mark and the bar under it were
                    drawn in the same near-black as the product name and the
                    price. On a tile that is otherwise photograph and figures,
                    a 3px black rule under the price does not read as "nearly
                    gone" — it reads as a border that escaped, and in the
                    redesigned grid it was the one mark on a tile that looked
                    like a mistake.

                    Brand orange is the right colour for it and it is the only
                    hue left with nothing else to do: yellow is the deal
                    language (the corner flag, the Super Deal chip, the deals
                    shelf), green is the saving, ink is type. Scarcity is the
                    remaining thing a tile says, and orange is what the shop
                    already spends on urgency in the masthead. */}
                <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-shop-primary" aria-hidden />
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
            className="mt-1 block h-[3px] w-full max-w-[90px] overflow-hidden rounded-full bg-shop-hairline"
          >
            <span
              className="block h-full bg-shop-primary"
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
        {/* ---- The store name came off the tile ----

            It used to ride the right-hand end of this row, and the argument for
            it was a good one: this is a marketplace, the tiles in one grid come
            from different shops, and the store is what a shopper uses to judge
            a listing they know nothing else about.

            What that argument missed is what the row does on the tiles with no
            numbers in it. `product.seller` was one of the three conditions that
            drew this row at all, so a product with no sales and no reviews —
            most of a young catalogue — rendered a row containing nothing but a
            store name pushed to the right by `ml-auto`, floating under a name
            it was not aligned with. Down a grid of forty tiles the eye reads
            that as forty rows of debris at forty different heights, which is
            the opposite of what a store name was added to buy.

            It is also the same words over and over. This catalogue is stocked
            by a handful of shops, so "Sports Kicks" was printing on most tiles
            on the screen — and a fact repeated on every tile stops being a way
            to tell them apart, which was the entire point of showing it.

            Nothing is lost: the store is named on the product page, where the
            decision is actually made, and it has its own shop page linked from
            there. The row now appears only when it has a NUMBER to carry, which
            is what makes the block below the name uniform from tile to tile. */}
        {(product.total_sales > 0 || product.rating_count > 0) && (
          <div className="flex items-center gap-x-2 overflow-hidden py-px">
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
          <div className="flex items-center gap-1 py-px">
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
      </div>

      {/* ---- The whole tile is the link ----

          Only the photograph and the name were clickable. Everything else — the
          price, the saving, the stock line, the swatches and all the whitespace
          between them — did nothing, and a shopper who taps a tile aims at the
          tile rather than at one of its two live regions. On a phone, where the
          name is a single 12px line and the gaps between rows are thumb-sized,
          most of the card was dead.

          A stretched overlay rather than wrapping the article in an anchor:
          wrapping would put the wishlist button and the add-to-cart button
          INSIDE a link, which is invalid HTML and makes both controls navigate
          on some browsers. The overlay covers the card and those two controls
          are lifted above it with `z-20`.

          `aria-hidden` and `tabIndex={-1}` because it is not a third route for
          anyone reading the page with assistive technology — the name is
          already a real link with the product name as its text, which is the
          one a screen reader should find. This adds a pointer target, not a
          destination.

          `z-10` puts it over the tile body and under those two controls. */}
      <Link
        href={href}
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 z-10"
      />
    </article>
  );
}
