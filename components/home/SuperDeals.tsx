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
    /* ---- Ink, and the reason the first attempt failed ----

       Four grounds have been under this shelf: white, #facc15, #fef08a, and
       ink. Only the last one is right, and the first ink attempt was reverted
       within the hour because it made every product in the band unreadable.
       That failure is the useful part, so here is exactly what it was.

       `ProductCard` is not a card above `md`. It is a TRANSPARENT block whose
       text sits directly on whatever is behind it, and all of that text is
       `text-shop-ink`. Dropping it onto #111827 put ink on ink: the names, the
       prices and the savings lines vanished. The band looked correct in
       isolation and deleted the information inside it.

       The mistake was treating the ground as the whole decision. A shelf's
       ground and the readability of the tiles standing on it are ONE decision,
       and the fix is not a lighter ground — it is giving the tiles a surface.
       Which the card already knows how to do: below `md` it is a white card
       with a hairline ring, precisely because the phone ground is not white
       either. This shelf turns that treatment on at every width.

       `md:[&_article]:…` rather than a prop on `ProductCard`. The card is
       rendered by a rail this component does not own, so there is no prop to
       thread; and the descendant selector has higher specificity than the
       card's own `md:bg-transparent`, so it wins without `!important`. The
       rule reads as what it is — "tiles inside this shelf are cards" — and it
       lives with the shelf that needs it rather than as a mode inside a
       component used in thirty other places.

       With the tiles on white, ink is finally free to do what yellow never
       could: white cards on #111827 is the highest contrast this shop can
       draw, so the photography is the brightest thing in the band. `shop-band`
       is not a new colour either — it already carries the footer. */
    <section
      aria-labelledby="super-deals-heading"
      /* ---- An ink panel, no longer a full-bleed band ----

         This escaped the column with `-mx-3 md:-mx-8` so its ink could reach
         the glass, which meant restating the column's own gutter here — a
         number that then lived in four files and could only be changed in all
         four at once. The page is a canvas with panels on it now, so the shelf
         stops where every other shelf stops and the canvas either side does
         what the bleed was for.

         `home-panel home-panel-ink` rather than a hand-rolled ground: the
         radius and the padding come from the shared class, so the loudest
         shelf on the page is the same shape and width as the quiet ones
         above and below it.

         ---- The tiles keep their white cards, and now at EVERY width ----

         The rule was `md:[&_article]:…`, because below `md` the tile drew its
         own white card and needed no help. It does not any more — `ProductCard`
         is one flat treatment at all widths now that sections are white panels
         — so on a phone this shelf was about to put ink-on-ink text straight
         onto a dark ground, which is the exact failure the note above records
         and which was reverted within the hour the first time.

         Dropping the `md:` prefix is the whole fix. A tile standing on this
         shelf gets a white card at any width, and the reasoning is unchanged:
         a shelf's ground and the readability of what stands on it are ONE
         decision. The descendant selector still beats the card's own classes
         without `!important`, and the rule still lives with the shelf that
         needs it rather than as a mode inside a component used in thirty
         other places. */
      className="home-panel home-panel-ink [&_article]:rounded-xl [&_article]:bg-white [&_article]:p-2 [&_article]:ring-1 [&_article]:ring-white/10"
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
