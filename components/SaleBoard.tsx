"use client";

import type { CSSProperties } from "react";
import ProductCard from "@/components/ProductCard";
import ProductFeedFooter from "@/components/ProductFeedFooter";
import { discountPercent } from "@/lib/currency";
import { sortProducts } from "@/lib/sort-products";
import { useProductFeed } from "@/lib/use-product-feed";
import type { Product } from "@/lib/woocommerce";

/**
 * The deal board on /sale, and the endless scroll behind it.
 *
 * ---- Why this is not just `InfiniteProducts` with a different query ----
 *
 * Every other infinite grid in the shop appends products to the end of a flat
 * list, and the list is the same object it was before, only longer. This page
 * does not have a list — it has three BANDS, and which band a product belongs
 * in is a property of the product rather than of its position. So a page of
 * reductions arriving from the server has to be re-sorted into the existing
 * bands, not appended after them: a 60%-off product fetched on page four
 * belongs at the top of the board beside the other 50%-and-overs, and appending
 * it would put the deepest cut on the page below two bands of shallower ones,
 * which is precisely what the banding exists to prevent.
 *
 * Hence a component of its own. The paging is still the shared
 * `useProductFeed`, so the fetch, the page counter, the de-duplication and the
 * three failure states are the same code every other grid runs — this file only
 * decides what a page of products means once it has arrived.
 *
 * ---- The bands are recomputed from the whole accumulated list ----
 *
 * Not merged band by band. Recomputing is O(n) over a few hundred products and
 * it is the only version that cannot drift: there is exactly one rule deciding
 * which band a product is in, and it runs over everything the shopper can see.
 * Merging would mean two rules — one for the first page, one for the rest — and
 * the day they disagreed the board would show a product in the wrong band with
 * no way to tell from the markup.
 */

export type SaleTier = {
  id: string;
  min: number;
  title: string;
  /** The band's shelf colour, painted by `.shop-panel-strong > .section-head`. */
  shelf: string;
};

export default function SaleBoard({
  initialProducts,
  totalPages,
  startPage,
  /** The sort the shopper chose, or undefined for the banded default. */
  sort,
  tiers,
  gridClassName,
}: {
  initialProducts: Product[];
  totalPages: number;
  startPage: number;
  sort?: string;
  tiers: SaleTier[];
  gridClassName: string;
}) {
  const feed = useProductFeed({
    initialProducts,
    totalPages,
    startPage,
    /* The same query the server ran for the first page. `on_sale` has to travel
       with the request rather than being applied after it — a page two of the
       whole catalogue filtered down to whatever happened to be reduced is not
       page two of the sale. */
    query: { onSale: true, sort },
  });

  /* `sortProducts` runs over the accumulated list rather than over each arriving
     page, and it has to: `discount` is the one sort WooCommerce cannot do — it
     is the gap between two meta values — so it is applied here, and sorting each
     page on its own would give three separately-sorted blocks stacked up. */
  const sorted = sortProducts(feed.products, sort);

  /* Banded only in the default order. Once a shopper has chosen "price, low to
     high" they have asked for one list in one order, and cutting that list into
     three discount bands would be answering a question they did not ask. */
  const banded = !sort;

  const bands = banded
    ? tiers
        .map((tier, index) => ({
          ...tier,
          /* Walked deepest-first, each band taking what the one above it did
             not, so a product lands in exactly one of them. */
          products: sorted.filter((product) => {
            const cut = discountPercent(product.regular_price, product.price);
            const ceiling = index === 0 ? Infinity : tiers[index - 1].min;
            return cut >= tier.min && cut < ceiling;
          }),
        }))
        .filter((tier) => tier.products.length > 0)
    : [];

  return (
    <>
      {banded ? (
        bands.map((band) => (
          <section
            key={band.id}
            className="shop-panel shop-panel-strong mb-1"
            /* The band colour, read by the same rule the homepage shelves use.
               Inline because it is per-band data rather than one of the eight
               fixed shelves that each have a class. */
            style={{ ["--shelf"]: band.shelf } as CSSProperties}
          >
            <div className="section-head flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="heading-black text-[18px] md:text-[21px]">{band.title}</h2>
              {/* The count is of what is ON the board, and it grows as more
                  arrives. It used to be the count on one page of 24, which on a
                  sale of three hundred products was a number about the
                  pagination rather than about the shop. */}
              <p className="section-sub text-[13px]">
                {band.products.length}{" "}
                {band.products.length === 1 ? "product" : "products"}
              </p>
            </div>
            <div className={gridClassName}>
              {band.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className={gridClassName}>
          {sorted.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <ProductFeedFooter
        feed={feed}
        doneLabel="That is everything reduced right now."
      />
    </>
  );
}
