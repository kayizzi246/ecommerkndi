"use client";

import { useCallback } from "react";
import ProductCard from "@/components/ProductCard";
import ProductFeedFooter from "@/components/ProductFeedFooter";
import { filterProducts, sortProducts, type ProductFilters } from "@/lib/sort-products";
import { useProductFeed, type ProductFeedQuery } from "@/lib/use-product-feed";
import type { Product } from "@/lib/woocommerce";

/**
 * The endless grid for the two pages that have a filter rail: /search and a
 * category.
 *
 * ---- Why these two cannot use `InfiniteProducts` ----
 *
 * Most of the shop's filters are sent to WordPress and applied across the whole
 * result set — the price window, the stock checkbox, the sort. Three are not,
 * and cannot be: the brand facet is read off the products themselves, and
 * "minimum discount" is a comparison between two meta values WooCommerce will
 * not order or filter by. So those three are applied AFTER the fetch, by
 * `filterProducts`, which is what the server pages already did to page one.
 *
 * That is fine while a page is a page. It stops being fine the moment the grid
 * scrolls forever: page two arrives from the API having passed only the filters
 * the server understands, and appending it raw puts products the shopper has
 * explicitly filtered out back under a heading that says they are filtered.
 * That is the bug this component exists to prevent — it runs the same
 * `filterProducts` over every arriving page, so what is on screen always
 * matches what the rail claims.
 *
 * ---- Sorting is over the whole board, not per page ----
 *
 * `sortProducts` runs on the accumulated list. Sorting each arriving page on
 * its own would give a grid of separately-sorted blocks stacked up — cheapest
 * to dearest, then cheapest to dearest again — which reads as the sort having
 * broken. The one sort WooCommerce cannot do (`discount`) is the reason this
 * pass exists at all; the others are already ordered by the server and
 * re-sorting them is a no-op that costs nothing at this size.
 */
export default function FilteredProductGrid({
  initialProducts,
  totalPages,
  startPage,
  query,
  filters,
  sort,
  gridClassName,
  /** Passed through to the tile, for the pages that override `--shell`. */
  sizes,
  doneLabel,
}: {
  /** The server's page one, already filtered and sorted. */
  initialProducts: Product[];
  totalPages: number;
  startPage: number;
  query: ProductFeedQuery;
  filters: ProductFilters;
  sort?: string;
  gridClassName: string;
  sizes?: string;
  doneLabel?: string;
}) {
  /* `refine` has to be stable or the feed re-subscribes its observer on every
     render — see `useProductFeed`. `filters` is written inline by both callers,
     so it is a fresh object each time and has to be compared by value. */
  const filterKey = JSON.stringify(filters);
  const refine = useCallback(
    (products: Product[]) => filterProducts(products, JSON.parse(filterKey) as ProductFilters),
    [filterKey]
  );

  const feed = useProductFeed({
    initialProducts,
    totalPages,
    startPage,
    query,
    refine,
  });

  const visible = sortProducts(feed.products, sort);

  return (
    <>
      <div className={gridClassName}>
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} sizes={sizes} />
        ))}
      </div>

      <ProductFeedFooter feed={feed} doneLabel={doneLabel} />
    </>
  );
}
