import type { Product } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/home/SectionHeader";
import CountdownBlocks from "@/components/home/CountdownBlocks";

/**
 * Super Deals — one row of genuinely discounted products, under a countdown.
 *
 * This used to be a purple promo card sitting beside its own product rail; the
 * card was a second heading for a section that already had one. Now the
 * countdown rides in the section header, and the whole width goes to products.
 *
 * The clock counts to real midnight, when the rail is rebuilt from whatever is
 * on sale then. A countdown that resets to eight hours on every page load is
 * the oldest trick on the internet and shoppers read it as a lie.
 *
 * Renders nothing when nothing is on sale: an empty "Super Deals" advertises a
 * promise the catalogue is not keeping.
 */
export default function SuperDeals({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="super-deals-heading">
      <SectionHeader title="Super Deals" href="/sale">
        <span className="flex items-center gap-2 rounded-lg bg-shop-sale/10 px-3 py-1.5 text-shop-sale">
          <span className="text-[12px] font-semibold">Ends in</span>
          <CountdownBlocks />
        </span>
      </SectionHeader>

      {/* Six across on a wide desktop, matching the grids either side of it —
          a row of five beside a row of six is the kind of half-alignment that
          reads as a mistake rather than a decision. */}
      <ul className="-mx-4 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar sm:gap-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 xl:grid-cols-6">
        {products.slice(0, 6).map((product) => (
          <li key={product.id} className="w-[47.5%] shrink-0 snap-start sm:w-[31%] lg:w-auto">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
