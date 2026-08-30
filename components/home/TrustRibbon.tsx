import Link from "next/link";
import { formatPrice } from "@/lib/currency";
import { PROOF_MINIMUM_REVIEWS, type HomeProof } from "@/lib/home-feed";

/**
 * One strip under the masthead carrying what the shop promises AND what it can
 * prove.
 *
 * ---- What this replaces, and why it is not the same band ----
 *
 * `PromiseBand` stood here: three terms — free delivery over a threshold, pay
 * on delivery, N-day returns — on the palest green in the palette, `hidden`
 * below `md`. It is deleted rather than left unrendered, because a component
 * nothing imports is a component nobody knows is dead.
 *
 * Two things were wrong with it, and only the second is obvious.
 *
 * The first is that it did not render on a phone. The note explaining that was
 * sound when it was written — the band was the fourth stacked strip above the
 * fold, after the delivery ticker, the masthead and the department row — and
 * the conclusion drawn was that the repetitive one should go. What actually
 * happened afterwards is that the department row was deleted, the rails were
 * hidden below `md`, and the hero became artwork-or-nothing. So on the shop's
 * majority device the page now opens on a bare grid of tiles, and the first
 * words a first-time shopper reads about delivery, payment or returns are at
 * the very bottom of an ENDLESS grid, which is to say never. The band was
 * hidden to save a phone screen from four bands; there are no longer four.
 *
 * The second is that promises are not evidence. "Pay on delivery" answers what
 * the shop will do; it does not answer the question a Ugandan shopper actually
 * arrives with, which is whether anyone else has bought here and got their
 * things. Nothing on the old homepage answered that — not one review count, not
 * one sales figure, not the number of sellers, on a page whose entire argument
 * is that it is a marketplace. The numbers existed: `average_rating`,
 * `rating_count` and `total_sales` ride on every product the feed fetches, and
 * `storeCount` had been computed and thrown away for months.
 *
 * So this band carries both halves. Evidence first — a rating, a sales floor, a
 * seller count — then the three terms. The order is the argument: proof earns
 * the right to make a promise.
 *
 * ---- It costs the same height it always did ----
 *
 * The old band's whole defence was that it earned roughly 36px against a row of
 * merchandise. This is still one line, still makes no offer, still carries no
 * picture, and still scrolls rather than wraps, so on a desktop the page below
 * it has not moved. On a phone it adds about 34px where previously there was
 * nothing at all, which is the cheapest trust the page can buy.
 *
 * ---- Every claim is enforced somewhere ----
 *
 * Unchanged from the band before it, and it matters more now that there are
 * numbers on the strip. The delivery threshold is the figure checkout applies,
 * the returns window is the one in wp-admin, "pay on delivery" is a payment
 * method the checkout really offers, and the three figures are floors computed
 * from live data — see {@link HomeProof} for why each one is smaller than the
 * truth rather than larger. A band of this kind is worth nothing if one line on
 * it is aspirational, because a shopper who catches the soft one stops
 * believing the rest.
 */
export default function TrustRibbon({
  freeDeliveryFrom,
  returnsDays,
  proof,
}: {
  /** The subtotal at which delivery stops being charged, from wp-admin. */
  freeDeliveryFrom: number;
  /** The returns window in days, from wp-admin. */
  returnsDays: number;
  /** Live figures from the feed. Any of them may be zero on a young shop. */
  proof: HomeProof;
}) {
  /**
   * ---- Two of these are already on screen, and only above a breakpoint ----
   *
   * The announcement strip at the very top of {@link Header} prints
   * `settings.promo.lines` on its right-hand end, and on this shop those lines
   * are "Pay on delivery" and "N-day free returns" — the same two promises,
   * about 110px higher up the same screen. Saying them twice within one glance
   * does not make either more believable; it makes the top of the page read as
   * a template that lost track of what it had already said.
   *
   * But the strip hides them on narrow screens, and that is the whole reason
   * this band exists: `lines[1]` is inside a `hidden sm:flex` wrapper and
   * `lines[2]` carries `hidden md:inline` on top of that. So a phone gets
   * neither, a small tablet gets one, and a desktop gets both.
   *
   * Each promise therefore names the width at which the strip takes over. The
   * classes are the exact mirror of the strip's, and they have to be read
   * together: if the strip's breakpoints move, or the shop rewrites its promo
   * lines in wp-admin to say something else, this list is the other half of
   * that decision and needs looking at.
   *
   * The delivery threshold has no `hideAt` because the strip never carries it.
   * The strip's free-delivery message only appears once there is something in
   * the basket and it is BELOW the threshold — which is the opposite audience
   * from the one this band is talking to.
   */
  const promises = [
    // A shop that has switched free delivery off gets the honest line rather
    // than "free delivery over UGX 0" — the same guard `TrustStrip` makes.
    {
      label:
        freeDeliveryFrom > 0
          ? `Free delivery over ${formatPrice(freeDeliveryFrom)}`
          : "Delivery countrywide",
      hideAt: "",
    },
    { label: "Pay on delivery", hideAt: "sm:hidden" },
    { label: `${returnsDays}-day returns`, hideAt: "md:hidden" },
  ];

  return (
    // ---- Ink, not the pale green the old band used ----
    //
    // The masthead above this is gray-900 and the strip now sits directly under
    // it, so a pale green line here would draw a third horizon across the top of
    // the page: dark chrome, pale band, white merchandise. Continuing the
    // masthead's own colour for one more line reads as the bottom edge of the
    // chrome instead, and the merchandise starts at a single clean boundary.
    //
    // It also solves the palette problem the green band was written around. The
    // note at the head of `globals.css` reserves green for delivery and holds
    // the shop to roughly 90% white with 5–8% orange, which is why the old band
    // could only ever use the palest green available and why it read as a
    // washed-out strip rather than as a statement. On ink, the shop's own orange
    // is 5.9:1 — the arithmetic the masthead already runs — so the figures can
    // be set in the brand colour and still pass AA, and the band spends no new
    // hue at all.
    <section
      aria-label="Why shop with KandiUg"
      /* ---- Desktop only, which reverses what this band was built for ----

         It was added specifically so a phone would stop opening on a bare grid
         with no statement anywhere about delivery, payment or returns, and it
         is now `hidden md:block`. Recording the reversal honestly rather than
         quietly, because the reason is not that the argument was wrong.

         The shop counted the bands above the merchandise on a phone and asked
         for two of them back: this one and the department row. That is the same
         accounting the original `PromiseBand` note did — it was hidden on a
         phone precisely because it was the fourth strip competing for the
         opening screen — and the masthead has since taken a permanently open
         search field, which is a better use of that height than either.

         What the phone keeps: the footer carries the delivery threshold and
         the returns window, and every product page carries the returns window
         and pay-on-delivery beside the price. (`TrustBar` at the foot of the
         homepage was the fullest telling of the four promises; it has been
         removed, as the fifth statement of facts already made above it.) What
         the phone loses is
         those facts ABOVE the fold, which was the point of the band — so if
         phone conversion moves, this is the first thing to put back.

         The evidence figures — the rating, the sales floor, the seller count —
         have no other home on the page at all and are simply not shown on a
         phone now. */
      className="hidden border-b border-white/10 bg-shop-band text-white md:block"
    >
      {/* ---- Wrapped on a phone, one scrolling line from `sm` up ----

          It was one scrolling line at every width, on the argument that a band
          which wraps silently doubles the height it was budgeted against a row
          of merchandise. That argument is right about the budget and wrong
          about which failure is worse, and a screenshot settles it: at 390px
          the line ended mid-price — "Free delivery over UGX 150,00" — because
          the threshold is the longest phrase on the strip and the cut landed
          inside its digits.

          A cut WORD says there is more to the right, and is the whole reason
          the rails on this page bleed past the viewport. A cut NUMBER says the
          page is broken. It is also the first thing on the shop's majority
          device, and a shopper who reads a severed price in the opening line
          has been handed a reason to doubt the band before they have read a
          word of it — the precise opposite of what a trust ribbon is for.

          So below `sm` it wraps. The cost is real and small: one more line of
          12.5px type, about 20px, on a band whose whole content is three or
          four short phrases. `whitespace-nowrap` stays on regardless, so the
          wrapping happens BETWEEN items and never inside one — no phrase ever
          breaks across lines, which is the failure this was avoiding in the
          first place.

          From `sm` up it is the single line it always was, because that is
          where the announcement strip takes the promises over and the row has
          room to spare. `no-scrollbar` is unprefixed on purpose: it is a plain
          rule in globals.css rather than a generated utility, so it takes no
          breakpoint variant, and it costs nothing at the widths that no longer
          overflow. */}
      <div className="mx-auto flex max-w-[var(--shell)] flex-wrap items-center gap-x-4 gap-y-1 whitespace-nowrap px-3 py-2 text-[12.5px] no-scrollbar sm:flex-nowrap sm:gap-y-0 sm:overflow-x-auto md:gap-x-5 md:px-8">
        {/* ---- The evidence, and it goes first ----

            Each figure renders only if it is real. A shop on its first day of
            trading shows none of them and the strip degrades to exactly the
            three terms the old band carried, which is the correct floor: a "0
            sold" chip is worse than silence, and "4.8 from 3 reviews" is worse
            than both. */}
        {proof.reviews >= PROOF_MINIMUM_REVIEWS && proof.rating > 0 && (
          <Item>
            {/* A filled star rather than the tick every other item uses. It is
                the one mark on the strip a shopper reads without reading the
                words beside it, and `star` is the amber this shop already
                spends on ratings everywhere else — the tile, the product page,
                the review summary. */}
            <svg aria-hidden className="h-3.5 w-3.5 shrink-0 text-star" viewBox="0 0 24 24" fill="currentColor">
              <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8L12 3.6Z" />
            </svg>
            <strong className="font-semibold text-white">{proof.rating.toFixed(1)}</strong>
            {/* "from N reviews", not "N happy customers". The count is the
                verifiable half and the adjective is the part nobody can check;
                a review count is a number a shopper can go and look at on any
                product page in the shop. */}
            <span className="text-white/70">
              from {formatCount(proof.reviews)}+ reviews
            </span>
          </Item>
        )}

        {proof.sold >= 100 && (
          <Item>
            <Tick />
            <span className="text-white/70">
              <strong className="font-semibold text-white">{formatCount(proof.sold)}+</strong> items
              delivered
            </span>
          </Item>
        )}

        {/* Two. Below that this is a marketplace claim resting on one trader,
            which is a claim about a shop rather than about a marketplace. */}
        {proof.stores >= 2 && (
          <Item>
            <Tick />
            <span className="text-white/70">
              <strong className="font-semibold text-white">{proof.stores}</strong> vetted{" "}
              {/* ---- One word, and it buys a whole row back ----

                  Measured rather than guessed. At 390px the band has 366px to
                  work with and the four chips come to 165 + 207 + 111 + 106,
                  which lands the strip on THREE wrapped rows — 81px of ink
                  above the merchandise, which is twice what this slot has ever
                  been allowed. Dropping "Ugandan" takes the first chip to
                  roughly 110px, which lets it share row one with the delivery
                  threshold and brings the whole band down to two rows.

                  Nothing is lost by cutting it here. "Independent Ugandan
                  sellers, vetted before they can list" is the subtitle of
                  {@link ShopByStore}, which is one of the three sections that
                  now renders on a phone — so the shopper meets the word on the
                  same screen, in a sentence with room for it.

                  A hidden word rather than two strings: writing the phone copy
                  and the desktop copy as separate literals is how a component
                  ends up with one of them quietly out of date. */}
              <span className="hidden sm:inline">Ugandan </span>
              stores
            </span>
          </Item>
        )}

        {/* ---- The terms, after the evidence ----

            A hairline before them rather than a heading. The old band opened
            with "Why choose KandiUg?" in bold, which spent the most valuable
            inch of the strip on a question instead of an answer; the name is
            already in the masthead, in the `<h1>` at the foot of the page and
            in the page title. A rule is enough to say the second half of the
            line is a different kind of statement from the first. */}
        <span aria-hidden className="hidden h-4 w-px shrink-0 bg-white/15 sm:block" />

      {/* ---- On a phone the list stops being a box and its items pack ----

          Two earlier attempts at this are worth recording, because both looked
          right and neither moved the number that mattered.

          It began as `flex shrink-0`, which made the whole `<ul>` one
          unshrinkable atom: the band wrapped, the list did not, and the
          promises ran off the right edge. Giving the list its own `flex-wrap`
          fixed the clipping and nothing else — measured at 390px, the band was
          still three rows and 81px tall.

          The reason is a flexbox property that is easy to forget: a WRAPPING
          flex item shrinks to the width of its line, not to the width of its
          content. So the `<ul>` resolved to the full 366px of the band, and a
          109px chip beside it could never share row one with it no matter how
          short either got. Trimming copy could not help, because the list was
          not too wide — it was, correctly, exactly as wide as the row.

          `display: contents` is what actually fixes it. Below `sm` the `<ul>`
          stops generating a box at all and its three `<li>`s become direct
          flex children of the band, so they pack and wrap alongside the
          evidence chips as one sequence: 109 + 207 on the first row, 111 + 106
          on the second. Two rows, 59px against the 36px it costs from `sm` up, and
          no chip clipped at 360px either.

          It is the same device `app/page.tsx` uses for its desktop-only rail
          wrapper, and for the same reason: a wrapper that must not disturb the
          flex layout it sits inside. The cost is that some screen readers drop
          list semantics from a `display: contents` list — which is exactly what
          deleting the `<ul>` and using plain spans would cost in every browser,
          so this is the weaker of the two regressions, not a new one. The
          `<section>` keeps its own `aria-label` either way.

          From `sm` up it is a normal flex item again — one rigid nowrap group
          on a band that is a single line at those widths. */}
        <ul className="contents sm:flex sm:shrink-0 sm:items-center sm:gap-x-4 md:gap-x-5">
          {promises.map((promise) => (
            <li
              key={promise.label}
              className={`flex shrink-0 items-center gap-1.5 ${promise.hideAt}`}
            >
              <Tick />
              <span className="text-white/70">{promise.label}</span>
            </li>
          ))}
        </ul>

        {/* Pushed to the far end, and only where there is an end to push it to.
            On anything narrower than `lg` the line is already full and a fourth
            destination would start the row scrolling before the first figure
            had been read. */}
        <Link
          href="/help"
          className="ml-auto hidden shrink-0 font-medium text-shop-primary transition-colors hover:text-white lg:block"
        >
          How buying here works ›
        </Link>
      </div>
    </section>
  );
}

/** One evidence item. Kept in step with the promise list beside it. */
function Item({ children }: { children: React.ReactNode }) {
  return <span className="flex shrink-0 items-center gap-1.5">{children}</span>;
}

/**
 * The tick, at the one weight it reads at on ink.
 *
 * `pop-green-on-dark` rather than `shop-save`: the palette carries a separate
 * green for dark grounds precisely because the 4.6:1 green used on white drops
 * to an unreadable smudge on #111827. Same reasoning as the masthead's orange.
 */
function Tick() {
  return (
    <svg
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 text-pop-green-on-dark"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

/**
 * Thousands as "12k", everything below as itself.
 *
 * A five-figure number set at 12.5px in the middle of a scrolling line is read
 * as noise rather than as a quantity — the shopper sees a long digit string and
 * skips it. Rounded DOWN to the nearest hundred before the "k", so the figure
 * stays a floor after formatting as well as before it: 12,940 prints as "12.9k"
 * and never as "13k".
 */
function formatCount(value: number) {
  if (value < 1000) return String(value);
  const hundreds = Math.floor(value / 100) / 10;
  return `${hundreds % 1 === 0 ? hundreds.toFixed(0) : hundreds.toFixed(1)}k`;
}
