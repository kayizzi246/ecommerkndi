import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";
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
 * ---- Four tiles each, and two on a phone ----
 *
 * Eight products across two panels on a desktop row.
 *
 * This was three each, on the argument that a fourth tile makes each one small
 * enough that the photograph stops selling and the panel becomes a table of
 * prices. That argument is real but it is about the PHONE, where a panel is the
 * full width of the screen: four tiles across 390px leaves each about 85px, and
 * at 85px a product photograph is a thumbnail and the name is two words and an
 * ellipsis.
 *
 * On a desktop the panel is half of a 1720px shell, so a fourth tile is still
 * roughly 200px — the same width the rails below run at, and no smaller than
 * anything else on the page.
 *
 * So the count follows the width instead of being one number: two per panel on
 * a phone, four from md up, which is where the panels stop stacking and start
 * sharing the row. Both panels are still handed four products; the grid is what
 * decides how many are on screen, and the two that fall to the second row on a
 * phone are a scroll away rather than gone.
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

  const lightning = products.slice(0, 4);
  const clearance = products.slice(4, 8);

  return (
    <section aria-labelledby="twin-deals-heading" className="grid gap-5 md:grid-cols-2 md:gap-6">
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
const TONES = {
  flame: "text-shop-primary-ink",
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
    <div>
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
          <h2
            id={id}
            className="heading-black truncate text-[18px] font-extrabold uppercase tracking-[0.01em] md:text-[21px]"
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

      {/* A grid, not a scroller. Four tiles fit in this panel at the widths it
          shares a row at, and a horizontal scroll with nothing off the end of
          it is a gesture that teaches a shopper the row is empty. The rails
          further down the page scroll because they hold twelve.

          Two columns on a phone and four from md, for the reason set out at
          the head of this file: the panel is full-width below md, where a
          quarter of the screen is not a product photograph. */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            priority={priority && index === 0}
            // Mirrors the grid above: two tiles across a full-width panel on
            // a phone, four across a half-width one from md, inside a shell
            // that stops at 1720px. These have to move together with the
            // `grid-cols-2 md:grid-cols-4` above and the breakpoint on the
            // parent section — a `sizes` string that disagrees with the grid
            // is how a page ends up downloading tablet-width photographs for
            // thumbnails.
            sizes="(max-width: 768px) 48vw, (max-width: 1720px) 12vw, 205px"
          />
        ))}
      </div>
    </div>
  );
}
