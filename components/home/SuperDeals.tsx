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
    <section aria-labelledby="super-deals-heading">
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
