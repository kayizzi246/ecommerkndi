import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import WishlistButton from "@/components/WishlistButton";
import TileCartButton from "@/components/TileCartButton";

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

/** "UGX 45,000" with the currency set small, the way the reference sets "£". */
function PriceFigure({ value }: { value: number }) {
  const [currency, ...figure] = formatPrice(value).split(" ");
  return (
    <>
      <span className="tile-price-currency">{currency}</span>
      {figure.join(" ")}
    </>
  );
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
  //   ≤640   2 cols  50vw
  //   ≤768   3       33vw
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
  "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1536px) 20vw, (max-width: 1720px) 17vw, 275px";

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
  /* The purple programme badge under the stars. The reduction itself is now
     the "Sale" chip leading the name, so it is not repeated here. */
  const chip = product.featured
    ? "Choice"
    : isNew
      ? "New"
      : topRated
        ? "Top rated"
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

  /* The orange line under the price: scarcity first, then the sales tier. */
  const proofLine = lowStock
    ? `Only ${product.stock_quantity} left`
    : ribbon;


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
    <article className="tile-card group relative flex h-full flex-col p-1.5">
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

               `object-cover` fills the tile edge to edge, so the grid reads as
               an even wall of photographs. The product page gallery is where
               the whole shot is shown uncropped (`.photo-contain`). */}
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
                  className={`object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] ${
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
      {/* 4px between the photograph and the first line of the name, down from
          6px. The note this replaces argued its way up from 4px to 8px on the
          grounds that the picture had lost the card that boxed it and needed
          the air to stop the name reading as a caption stuck to its bottom
          edge — but the tile has a real card again and draws its own edge, so
          the separation is being made twice. Taking one of them back is the
          cheapest height on the tile: it is paid once per row, on every row of
          every screen a shopper scrolls. */}
      {/* ---- Detail, on the marketplace-grid model ----

           One neutral sans (Arial/Helvetica, via `.tile-type` in globals.css)
           for every row, in this order:

             name (one line, with a "Sale" chip leading it on a reduction)
             price · sold count · cart button
             Was: original price            — reductions only
             orange proof line              — bestseller tier or low stock
             stars · review count
             programme badge                — Choice / Top rated / New

           Delivery, swatches and the saving chip are on the product page. */}
      <div className="tile-type flex flex-1 flex-col pt-1.5">
        <Link href={href} className="block">
          <h3 className="product-name truncate text-[13px] leading-[18px] text-[#222] transition-colors hover:text-shop-primary">
            {discount > 0 && !soldOut && (
              <span className="tile-sale-chip mr-1 align-[1px]">
                <svg aria-hidden className="h-[9px] w-[9px]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11.3 1.5c.3 2.6-.9 4.2-2.3 5.6C7.6 8.5 6 10 6 12.6 6 15.6 8.2 18 11 18s5-2.2 5-5.3c0-1.9-.8-3.4-1.8-4.6-.2 1.3-.9 2.2-1.9 2.6.6-3.4-.3-7-1-9.2Z" />
                </svg>
                Sale
              </span>
            )}
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center gap-1.5 pt-1">
          <p className="flex min-w-0 flex-1 items-baseline gap-x-1.5 overflow-hidden whitespace-nowrap">
            <span
              className={`tile-price ${discount > 0 ? "text-[#fb7701]" : "text-[#222]"}`}
            >
              <PriceFigure value={product.price} />
            </span>
            {product.total_sales > 0 && (
              <span className="truncate text-[12px] text-[#777]">
                {compactSold(product.total_sales)}+ sold
              </span>
            )}
          </p>
          <div className="relative z-20">
            <TileCartButton product={product} />
          </div>
        </div>

        {discount > 0 && (
          <p className="truncate pt-0.5 text-[12px] leading-[16px] text-[#777]">
            Was: <span className="line-through">{formatPrice(product.regular_price)}</span>
          </p>
        )}

        {soldOut ? (
          <p className="truncate pt-0.5 text-[12px] leading-[16px] text-[#777]">Back in stock soon</p>
        ) : (
          proofLine && (
            <p className="truncate pt-0.5 text-[12px] uppercase leading-[16px] text-[#fb7701]">
              {proofLine}
            </p>
          )
        )}

        {product.rating_count > 0 && (
          <div className="flex items-center gap-1 pt-0.5">
            <Stars rating={product.average_rating} />
            <span className="text-[12px] leading-none text-[#555]">
              {product.rating_count.toLocaleString("en-US")}
            </span>
          </div>
        )}

        {chip && (
          <p className="pt-1">
            <span className="tile-badge">
              <svg aria-hidden className="h-[10px] w-[10px]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5Z" />
              </svg>
              {chip}
            </span>
          </p>
        )}
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
