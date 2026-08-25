"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";

/**
 * "You may also like", under the cart lines.
 *
 * Fetched in the browser rather than passed down from the server: the cart page
 * is a client component, and this is below-the-fold content on a page no search
 * engine indexes — so there is nothing to gain from rendering it up front, and
 * one request saved on every other page that does not need it.
 *
 * `excludeIds` is what is already in the basket. Recommending someone the thing
 * they have just added reads as broken, and it is the one row of products that
 * cannot possibly increase the order.
 */
export default function CartRecommendations({ excludeIds }: { excludeIds: number[] }) {
  const [products, setProducts] = useState<Product[]>([]);

  // The cart's contents are the input, but only as a list of ids to leave out —
  // so the dependency is the joined string, not the array, which would be a new
  // reference on every render and refetch forever.
  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    // Abandoned if the shopper leaves before it lands, so a late response can
    // never call setState on an unmounted component.
    const controller = new AbortController();

    (async () => {
      try {
        // A wider page than the row needs: after removing what is already in
        // the basket there must still be enough left to fill it.
        const response = await fetch("/api/products?page=1&per_page=16", {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as { products: Product[] };
        const excluded = new Set(excludeKey ? excludeKey.split(",").map(Number) : []);

        setProducts(payload.products.filter((p) => !excluded.has(p.id)).slice(0, 5));
      } catch {
        // A failed suggestion row is not worth an error message — the cart
        // itself is unaffected, so the section simply stays hidden.
      }
    })();

    return () => controller.abort();
  }, [excludeKey]);

  // Nothing to show, or a catalogue too small to have anything left over once
  // the basket is excluded. Rendering an empty heading would look like a bug.
  if (products.length === 0) return null;

  return (
    <section className="mt-10 border-t border-shop-line pt-8">
      <h2 className="mb-4 section-title text-[18px] text-shop-ink">You may also like</h2>

      {/* The homepage grid, so a product looks the same wherever it appears. */}
      <ul className="grid grid-cols-2 gap-x-1.5 gap-y-3 sm:grid-cols-3 md:gap-x-3 md:gap-y-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
