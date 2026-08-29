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
      /* ---- The same panel as everything else, and no card override ----

         Five grounds have now been under this shelf: white, #facc15, #fef08a,
         ink, and the page's own panel. The history is kept in globals.css where
         `.shop-panel-ink` used to live; the short version is that ink was
         reverted once within the hour for making every tile on the shelf
         unreadable, brought back with a rule that gave the tiles white cards,
         and is now gone for a different reason — the shop wants one background
         across the page.

         What that retires is not just a colour. The `[&_article]:` overrides
         went with it, and so did `tone="dark"` on the header below: a shelf
         whose ground matches every other shelf needs no special contrast
         reasoning, no card mode, and no second heading treatment. This section
         is now the shortest one in the folder, which is the correct size for
         "a rail of discounted products under a countdown".

         The emphasis it gives up is real. What carries the section now is the
         countdown, the subtitle and the depth of the cuts themselves — content
         rather than colour. */
      className="shop-panel shop-panel-accent"
    >
      <SectionHeader
        id="super-deals-heading"
        title="Super Deals"
        subtitle="Today's deepest cuts"
        href="/sale"
      >
        {/* The countdown chip. It kept a pale ground back when the shelf was
            ink and everything else on it had to be inverted; the ground is the
            page's own now, so the chip is simply the brand's soft tint with
            `shop-primary-ink` on it — 5.9:1, the pairing the shop uses for any
            small orange-on-light label. */}
        <span className="flex items-center gap-2 rounded-lg bg-shop-primary-soft px-3 py-1.5 text-shop-primary-ink">
          <span className="text-[12px] font-semibold">Ends in</span>
          <CountdownBlocks />
        </span>
      </SectionHeader>

      <DealCarousel products={products} />
    </section>
  );
}
