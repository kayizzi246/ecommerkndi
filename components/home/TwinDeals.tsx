import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import DealCarousel from "@/components/DealCarousel";
import CountdownBlocks from "@/components/home/CountdownBlocks";

/**
 * Two deal panels side by side — Lightning Deals and Clearance Deals.
 *
 * ---- What this is for ----
 *
 * A rail says "here are twelve things". Two named panels say "there are two
 * different kinds of saving in this shop, and they are not the same kind" —
 * which is the thing a price-led marketplace homepage is actually trying to
 * communicate above the fold. The reference this follows runs exactly this
 * shape at the top of its page, and it works because the two headings do the
 * merchandising that a single undifferentiated "Deals" rail cannot.
 *
 * The distinction here is real rather than decorative:
 *
 *   • LIGHTNING is time-bound. It carries the countdown, it is rebuilt at
 *     midnight from whatever is on sale then, and its urgency is honest for
 *     exactly that reason — see {@link CountdownBlocks}, which counts to real
 *     midnight rather than resetting to eight hours on every page load.
 *   • CLEARANCE is not time-bound. It is the deepest cuts in the catalogue,
 *     and it stays there until the stock does not.
 *
 * If those two ever draw from the same pool, this component has stopped saying
 * anything and should go back to being one rail.
 *
 * ---- Where the products come from, and why nothing is duplicated ----
 *
 * Both halves are sliced from `dailyDeals`, which `lib/home-feed.ts` already
 * claims through the no-repeat ledger and which this page was, until now,
 * throwing away — the feed built a 16-product rail of the deepest cuts and the
 * homepage rendered none of it.
 *
 * Slicing one claimed rail rather than claiming two is what keeps the ledger's
 * guarantee intact. `deals` — the rail under Super Deals further down the page
 * — is a separate claim, so nothing here reappears there.
 *
 * ---- Each panel is a rail, not a grid ----
 *
 * Both halves were a fixed grid of four tiles — two rows of two on a phone, one
 * row of four from md. Four was the ceiling because a grid has to fit
 * everything it holds on screen at once, so twelve of the sixteen products
 * `dailyDeals` claims were thrown away to make that arithmetic work, and the
 * two tiles that wrapped to a second row on a phone were a scroll DOWN, past
 * the panel, rather than a swipe along it.
 *
 * Each panel now runs {@link DealCarousel} — the same rail, the same
 * `ProductCard`, the same snap scrolling and edge arrows as Super Deals and
 * every department below it. What that buys:
 *
 *   • The panel holds everything it is handed rather than four. `dailyDeals`
 *     splits down the middle, so each rail runs eight deep on the standard feed.
 *   • The tile sliced by the right edge says "there is more this way", which is
 *     the one thing a finished 2×2 grid can never say.
 *   • A `viewAll` tile ends each track, so the last swipe lands on the way
 *     through to /sale rather than on a half tile against the edge.
 *
 * `itemWidth` is the one thing that cannot be copied from the rails below,
 * because those span the whole shell and these span half of it from md up. The
 * ramp is derived at the call site.
 */
export default function TwinDeals({ products }: { products: Product[] }) {
  // Eight products or this does not run. A panel with one tile in it is a gap
  // with a heading over it, and two ragged panels side by side look broken in a
  // way one short rail does not.
  //
  // `dailyDeals` is claimed at 16, so this clears comfortably on any catalogue
  // with a real sale on it — and a shop with fewer than eight discounted
  // products should not be opening its homepage on two deal panels anyway.
  if (products.length < 8) return null;

  // Split down the middle rather than taking a fixed four each: a rail holds as
  // many as it is given, and `dailyDeals` is claimed at 16, so the standard feed
  // puts eight products in each panel. An odd count sends the extra one to
  // Lightning, which is the panel carrying the countdown and the one a shopper
  // reaches first.
  const half = Math.ceil(products.length / 2);
  const lightning = products.slice(0, half);
  const clearance = products.slice(half);

  return (
    // ---- `grid-cols-1`, spelled out, and it is load-bearing ----
    //
    // This was a bare `grid` below md, which leaves `grid-template-columns` at
    // `none` — so the panels land in an IMPLICIT column sized `auto`, and an
    // auto column is allowed to size itself to its contents. What it contains
    // is a carousel whose natural width is every tile laid end to end, about
    // 1630px, and the tiles inside it are sized as a percentage OF that column.
    // A percentage of a column that is itself sized by its contents does not
    // constrain anything: the column blew out to content width and each "38.5%"
    // tile came back about 620px, which is why the phone showed one product.
    //
    // An explicit `grid-cols-1` makes the mobile column `1fr` — a definite
    // share of the section — so the percentages inside resolve against the page
    // column, not against the track's own content.
    <section
      aria-labelledby="twin-deals-heading"
      className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6"
    >
      {/* The section needs one accessible name and has two visible headings, so
          the first panel's heading is the labelled one and the second is a
          heading in its own right within it. */}
      <DealPanel
        id="twin-deals-heading"
        title="Lightning Deals"
        href="/sale"
        products={lightning}
        // ---- The two headings are different colours, and that is the point ----
        //
        // The whole reason this is two panels rather than one rail is that the
        // shop has two different kinds of saving. If both headings were set in
        // the page's ordinary near-black, a shopper scanning the opening screen
        // would read one wide block of deals with a redundant second title in
        // the middle of it, which is what the layout is trying not to be.
        //
        // Lightning takes the brand's deep orange — it is the timed, branded
        // event, and it is the panel wearing the countdown, so it should be the
        // one the eye lands on first. #b34a00 is 6.4:1 on white, which is why
        // the ink variant is used rather than #ff6a00 at 2.9:1.
        tone="flame"
        // Only this panel gets a countdown. Putting one over both would be the
        // dishonest version of this layout: clearance is not on a clock, and a
        // timer over stock that will still be there tomorrow is the trick the
        // countdown component was written to avoid.
        clock
        // The leading tiles of the first panel are the page's largest paint on
        // a phone now that the hero is gone, so they load eagerly.
        priority
      />
      <DealPanel
        title="Clearance Deals"
        href="/sale"
        products={clearance}
        // Clearance takes the shop's reduced-price red. That token is defined
        // as "a reduced price, and nothing else", and this is the one heading
        // on the site where the heading IS the reduced price — the panel holds
        // nothing but marked-down stock, and the same red is already printing
        // on every tile underneath it. Using any other red here would put a
        // second one on screen; using near-black would leave the two panels
        // indistinguishable at a glance. #dc2626 is 4.8:1 on white.
        tone="clearance"
      />
    </section>
  );
}

/**
 * The two colours a panel heading can take.
 *
 * A closed set rather than a className prop, so a third panel cannot quietly
 * introduce a fourth hue to a page whose palette note budgets 5–8% colour in
 * total. Both entries are AA on white at this size; see the notes at the call
 * sites for why each panel gets the one it does.
 */
/* ---- The two deal colours, one step brighter ----
 *
 * Lightning was `shop-primary-ink` — #b34a00, the deep burnt step of the
 * brand orange. It was chosen for contrast and it is genuinely readable, but
 * at 21px uppercase it reads brown rather than orange, and a heading that is
 * meant to be the loudest thing on the opening screen should not be the
 * muddiest colour on it.
 *
 * `shop-primary-dark` (#e85d00) is the compromise that survives both tests.
 * It is unmistakably the brand orange rather than a burnt derivative of it,
 * and it clears 3.4:1 on white — over the 3:1 that WCAG asks of large text,
 * which these headings are at 18px and 700. The full `shop-primary` (#ff6a00)
 * is what the reference uses and it lands at 2.9:1, under the bar even for
 * large type, so it is the one step too far.
 *
 * Clearance keeps `shop-sale-price` (#dc2626), which is already the vivid red
 * the reference runs and already clears the bar. The token exists precisely
 * because plain #e53935 did not. */
const TONES = {
  flame: "text-shop-primary-dark",
  clearance: "text-shop-sale-price",
} as const;

function DealPanel({
  id,
  title,
  href,
  products,
  tone,
  clock = false,
  priority = false,
}: {
  id?: string;
  title: string;
  href: string;
  products: Product[];
  tone: keyof typeof TONES;
  clock?: boolean;
  priority?: boolean;
}) {
  return (
    // `min-w-0` because `grid-cols-1` above only fixes half of it: `1fr` is
    // `minmax(auto, 1fr)`, and that `auto` minimum is still the panel's
    // content-based floor, which a grid item is never allowed to shrink below.
    // Together the two make the column a true `minmax(0, 1fr)` — a definite
    // width the carousel's percentages can resolve against.
    <div className="min-w-0">
      <div className="mb-3 flex items-center gap-3">
        {/* ---- Loud, and not the same loud as the rest of the page ----

            Uppercase, tracked out, and heavier than anything else in the
            column. Every other heading on this page is a signpost — sentence
            case, near-black, deliberately restrained, because a page whose job
            is showing products should not have its titles winning. These two
            are the exception, and the reason is that they are not signposts:
            they are the offer itself, on the opening screen, and a deal panel
            whose heading whispers is a deal panel nobody reads.

            Still 18/21 rather than the 22/26 a `SectionHeader` runs at, which
            is why this is not reusing that component. Two of these share one
            row, so each is half a section wide; the weight and the colour do
            the shouting instead of the point size, and the row stays narrow
            enough for the countdown to sit beside it.

            The colour comes from the call site — see `TONES`. */}
        <Link
          href={href}
          className={`group flex min-w-0 items-center gap-1 transition-opacity hover:opacity-80 ${TONES[tone]}`}
        >
          {/* ---- Genuinely heavy, which needed changing the FACE ----

              This read `heading-black ... font-extrabold` and rendered at 700.
              Not approximately — exactly 700, every time, on every machine.
              `.heading-black` sets the display face, this shop loads Poppins as
              two static instances (600 and 700, see `layout.tsx`), and
              `font-synthesis-weight: none` in `globals.css` means a weight that
              was not downloaded is not faked. So the 800 resolved to the nearest
              real instance and the class had no effect at all. Asking for
              "very bold" here could not be answered by asking harder.

              There were two ways out. Add 800 to the Poppins array, which costs
              a Ugandan shopper another font file on first paint — the exact
              cost `layout.tsx` spends a paragraph refusing. Or set these two
              headings in the UI face, which is Inter, loaded VARIABLE, covering
              100-900 in the file the page already downloads.

              The second is free, so it is the one taken. 900 is a real weight
              here rather than a request, and it is the register the reference
              runs: an uppercase grotesque at maximum weight. `font-ui` is
              deliberately spelled as an arbitrary family so nothing has to be
              added to the theme for two headings.

              The rest of the page keeps Poppins. This is the one place on the
              homepage where the type IS the promotion, which is the same
              exception the note below already argued for. */}
          <h2
            id={id}
            className="truncate font-[family-name:var(--font-ui)] text-[19px] font-black uppercase leading-none tracking-[0.005em] md:text-[23px]"
          >
            {title}
          </h2>
          <svg
            aria-hidden
            className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
        </Link>

        {clock && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-shop-primary-ink">
            <span className="hidden text-[11.5px] font-semibold sm:inline">Ends in</span>
            <CountdownBlocks />
          </span>
        )}
      </div>

      {/* ---- This rail needs its own width ramp, because a panel is half a shell ----

          Every percentage `DealCarousel` ships by default is a percentage of a
          track that spans the whole page. This track spans half of one from md
          up — the breakpoint where the parent section stops stacking — so the
          defaults would put roughly half as many tiles on screen as intended,
          each at half the width.

          So the ramp is written against the PANEL, not the page:

            base   vw    two tiles and most of a third; panel is full-width,
                         and the unit is `vw` because this panel sits in a grid
                         column — see the note on the section above, and the
                         long one on `itemWidth` in `DealCarousel`
            sm     31%   three and a peek, still full-width
            md     45%   two and a peek — the panels have just halved
            lg     31%   three and a peek, as the halves grow
            xl     23%   four and a peek, which against a 1720px shell is a
                         ~198px tile: the same size the full-width rails below
                         settle at, so a product is not two sizes on one page

          Every step leaves a fraction over, and that fraction is the peek — a
          rail showing a whole number of tiles reads as a finished grid nobody
          swipes. No `sizes` override: `DealCarousel` carries its own, and those
          numbers land within a step of these at every breakpoint.

          The base step is the one place this ramp does NOT diverge from the
          shared default, and it deliberately matches it character for character
          — below `sm` these panels are full-width, so they are the same track
          as any other rail and should show the same 2.3 tiles. The 40px is the
          `px-3` page gutter plus the two `gap-2` seams standing between three
          tiles; see the long note on `itemWidth` in `DealCarousel` for why the
          count is neither a plain percentage nor measured against the track. */}
      <DealCarousel
        products={products}
        itemWidth="w-[calc((100vw-40px)/2.3)] sm:w-[31%] md:w-[45%] lg:w-[31%] xl:w-[23%]"
        priority={priority}
        // "All Lightning" / "All Clearance" — the panel titles minus the word
        // both of them share, which the tile's own context already supplies.
        viewAll={{ href, label: `All ${title.replace(" Deals", "")}` }}
      />
    </div>
  );
}
