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
    /* ---- White, after yellow and after ink ----

       Four grounds have been under this shelf and the last two failed on the
       SAME axis, which is the part worth recording.

       Yellow, at two weights: a large field of a LIGHT colour cannot make
       white product cards stand out, because the cards are lighter still.
       The tiles read as holes punched in a sheet.

       Ink: the opposite error, and worse. White cards on #111827 do have the
       contrast — but `ProductCard` is not a card above `md`. It is a
       transparent block whose text sits directly on whatever is behind it,
       and all of that text is `text-shop-ink`. On an ink band the product
       names, the prices and the savings lines were ink on ink: invisible.
       The shelf looked right in isolation and deleted the information inside
       it.

       That is the real constraint and it is not about taste: this shelf can
       only take a ground that `ProductCard`'s own ink type reads against.
       That means LIGHT, and light cannot also make white cards pop. The two
       requirements are in direct conflict, so the shelf stops attempting the
       second.

       So the ground is white, like every other section, and the separation is
       drawn rather than filled: a hairline above and a hairline below, running
       the full width. That is the smallest mark that says "this is one shelf"
       and the only one that costs the tiles nothing — a rule has no area, so
       there is no field for the photography or the type to fight.

       The deal language is carried by the yellow chip and the yellow flag ON
       the tiles, where a small saturated object works, rather than by the
       ground under them. That is where it should have been all along.

       Full-bleed via `-mx-`, matched exactly to the column's own `px-3
       md:px-8`: a band that respected the gutter would float with a white
       sliver down each edge, and one that overshot would hang off the page
       and give the document a horizontal scrollbar. */
    <section
      aria-labelledby="super-deals-heading"
      className="-mx-3 border-y border-shop-line px-3 py-5 md:-mx-8 md:px-8 md:py-6"
    >
      <SectionHeader
        id="super-deals-heading"
        title="Super Deals"
        subtitle="Today's deepest cuts"
        href="/sale"
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
