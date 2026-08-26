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
    /* ---- The one section with a ground of its own ----

       Yellow, and it is the only coloured band left on this page — which is
       what makes it work. Super Deals is the deepest-cut strip in the shop and
       it sits between two sections drawn on plain white, so the band does the
       job a heading cannot: saying "this part is different" before a word is
       read.

       `bfl-yellow-soft` (#fef08a), not the saturated `bfl-yellow` this first
       shipped with. At full strength the ground fought the eight white product
       cards sitting on it — they read as holes punched in a yellow sheet rather
       than as products on a shelf. The soft step is about halfway to white,
       which is enough to say "this section is different" and light enough that
       the merchandise still sits on top of it.

       The saturated value did not go to waste: it is the Super Deal chip on
       the tiles this shelf collects, where a small object does need full
       strength to hold against a photograph. Shelf and chip are the same hue at
       two weights, which is the association without the shouting.

       `bfl-yellow` was already in the palette and unused on the
       storefront. It is worth knowing WHY it was unused, because the reason is
       still true and is the constraint this has to respect: the masthead strip
       was yellow once and came out for being a second brand colour in a shop
       that has one. That argument was about CHROME — a permanent band across
       every page. This is one merchandising section on one page, which is the
       case a second colour is actually for.

       Ink on #fef08a is about 16:1 — higher than the 11:1 the saturated step
       gave — so the heading and the countdown inside stay
       legible with no token changed. The tiles keep their white cards and read
       as products on a coloured shelf rather than as a recoloured grid.

       Full-bleed via `-mx-`, then padded back: the column this sits in carries
       `px-3 md:px-8`, so a band that respected the gutter would float with a
       white sliver down each edge and read as a card rather than a shelf. The
       negative margin cancels the gutter and the padding puts the content back
       — the same trick, for the same reason, as the promise band at the top of
       the page. */
    <section
      aria-labelledby="super-deals-heading"
      className="-mx-3 bg-bfl-yellow-soft px-3 py-5 md:-mx-8 md:px-8 md:py-6"
    >
      <SectionHeader
        id="super-deals-heading"
        title="Super Deals"
        subtitle="Today's deepest cuts"
        href="/sale"
      >
        <span className="flex items-center gap-2 rounded-lg bg-shop-primary-soft px-3 py-1.5 text-shop-primary-ink">
          <span className="text-[12px] font-semibold">Ends in</span>
          <CountdownBlocks />
        </span>
      </SectionHeader>

      <DealCarousel products={products} />
    </section>
  );
}
