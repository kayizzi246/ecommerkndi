import type { Product } from "@/lib/woocommerce";
import DealCarousel from "@/components/DealCarousel";
import SectionHeader from "@/components/home/SectionHeader";
import CountdownBlocks from "@/components/home/CountdownBlocks";

/**
 * Super Deals — genuinely discounted products, under a countdown.
 *
 * Built exactly like Trending now: a {@link SectionHeader} over a
 * {@link DealCarousel}. It used to be a hand-rolled hybrid — a scroll strip on
 * a phone that became a five- or six-column grid at `lg` — which meant this one
 * section scrolled differently from every rail above and below it, capped at
 * six products, and drifted out of alignment whenever the shared carousel's
 * widths were touched. Sharing the rail component means it cannot drift again,
 * and the section now holds as many products as it is given.
 *
 * The countdown rides in the header rather than in a card of its own, and it
 * counts to real midnight, when the rail is rebuilt from whatever is on sale
 * then. A countdown that resets to eight hours on every page load is the oldest
 * trick on the internet and shoppers read it as a lie.
 *
 * Renders nothing when nothing is on sale: an empty "Super Deals" advertises a
 * promise the catalogue is not keeping.
 */
export default function SuperDeals({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    /* ---- Ink, not yellow ----

       This shelf has now been three things: white like every other section, a
       saturated #facc15, and a soft #fef08a. The yellow was asked for and it
       was tried honestly at two weights, so it is worth being precise about why
       neither worked, because the failure is the same one both times.

       A large field of a LIGHT colour cannot make white product cards stand
       out, because the cards are lighter still. At full strength the tiles read
       as holes punched in a yellow sheet; softened, the band lost its authority
       and became a faint tint that looked more like a rendering artefact than a
       decision. Yellow is a highlighter — it works on small objects against
       their surroundings, which is exactly where it now lives on this page: the
       Super Deal chip and the discount flag on the tiles this shelf collects.

       Ink inverts the problem instead of restating it. White cards on #111827
       is the highest contrast this shop can draw, so the photography is the
       brightest thing in the band and the products come forward rather than
       being flattened by their own ground. It is also not a new colour —
       `shop-band` is the shop's dark surface, already carrying the footer and
       the closing panel — so the page gains a shelf without gaining a hue.

       The countdown needs no change: `shop-primary-soft` is a pale chip and
       `shop-primary-ink` is dark type on it, which reads on any ground. The
       "View All" link needs none either — #ff6a00 is 5.9:1 on #111827, the
       same arithmetic the masthead runs.

       Full-bleed via `-mx-`, then padded back, matched exactly to the column's
       own `px-3 md:px-8`. A band that respected the gutter would float with a
       white sliver down each edge and read as a card rather than a shelf; a
       band that overshot it would hang off the page and give the document a
       horizontal scrollbar. */
    <section
      aria-labelledby="super-deals-heading"
      className="-mx-3 rounded-none bg-shop-band px-3 py-5 md:-mx-8 md:px-8 md:py-7"
    >
      <SectionHeader
        id="super-deals-heading"
        title="Super Deals"
        subtitle="Today's deepest cuts"
        href="/sale"
        tone="dark"
      >
        {/* The one chip on the page that keeps a pale ground on a dark band:
            it is a countdown, it has to be read at a glance, and dark type on
            a pale chip is the most legible pairing available in either
            direction. */}
        <span className="flex items-center gap-2 rounded-lg bg-shop-primary-soft px-3 py-1.5 text-shop-primary-ink">
          <span className="text-[12px] font-semibold">Ends in</span>
          <CountdownBlocks />
        </span>
      </SectionHeader>

      <DealCarousel products={products} />
    </section>
  );
}
