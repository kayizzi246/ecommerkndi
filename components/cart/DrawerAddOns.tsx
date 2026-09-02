"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/woocommerce";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";

/**
 * "Add to your order", inside the side cart.
 *
 * ---- Why the drawer and not just the cart page ----
 *
 * `app/cart/page.tsx` already carries `CartRecommendations`, and the drawer
 * carried nothing. That is backwards: adding a line OPENS the drawer, so the
 * drawer is the surface almost every shopper sees, and `/cart` is the one they
 * only reach if they deliberately go looking for it. The shop was putting its
 * only cross-sell on the quieter of the two.
 *
 * ---- Why it is priced against the free-delivery gap ----
 *
 * The panel above this one already tells the shopper "add UGX 12,000 more for
 * free delivery" and then leaves them to work out what, which means closing the
 * drawer, browsing, and hoping to land near the number. Most people simply do
 * not — the nudge names a target and hands over no way to hit it.
 *
 * So when there is a shortfall, the row is SORTED by how neatly each item
 * closes it: the cheapest things that get the basket over the line come first,
 * and only when nothing does are the near-misses shown. The shopper is not
 * being sold a random product, they are being handed the answer to the question
 * the bar above just asked.
 *
 * ---- What is deliberately excluded ----
 *
 * Anything with options, and anything out of stock. A "Choose size" link here
 * would close the drawer and send the shopper to a product page — abandoning
 * the basket they were two taps from paying for, to fix a suggestion they never
 * asked for. Every row in here is one tap or it does not appear.
 */
export default function DrawerAddOns({
  /** Order subtotal, so the row knows how far off free delivery the basket is. */
  subtotal,
  /** The wp-admin threshold. 0 when the shop is not running the offer. */
  freeDeliveryFrom,
  /** Product ids already in the basket. */
  excludeIds,
  /** Focus is trapped in the drawer while it is shut — see `CartDrawer`. */
  focusable,
}: {
  subtotal: number;
  freeDeliveryFrom: number;
  excludeIds: number[];
  focusable: boolean;
}) {
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        // A wide page, because the filter below is aggressive: everything with a
        // size or a colour is thrown away, and on a fashion catalogue that can
        // be most of a page.
        const response = await fetch("/api/products?page=1&per_page=24", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { products: Product[] };
        setProducts(payload.products ?? []);
      } catch {
        // A suggestion row that fails to load is not worth an error message.
        // The basket is unaffected and the section simply stays hidden.
      }
    })();

    return () => controller.abort();
    // Fetched once per mount. The drawer stays mounted for the life of the
    // page, so refetching on every basket change would be a request per tap of
    // a quantity stepper.
  }, []);

  /* The shortfall the bar above is quoting, or 0 when there is nothing to
     close — the shop is not running the offer, or the basket already clears
     it. */
  const away =
    freeDeliveryFrom > 0 ? Math.max(0, freeDeliveryFrom - subtotal) : 0;

  const excludeKey = excludeIds.join(",");

  const picks = useMemo(() => {
    const excluded = new Set(
      excludeKey ? excludeKey.split(",").map(Number) : []
    );

    const eligible = products.filter(
      (product) =>
        !excluded.has(product.id) &&
        product.stock_status === "instock" &&
        // Options mean a variation has to be chosen, and choosing it is a
        // different page. See the note at the head of the file.
        !(product.attributes ?? []).some((attr) => attr.options.length > 0) &&
        product.price > 0
    );

    if (away <= 0) {
      // No gap to close, so the row goes back to being an ordinary suggestion:
      // whatever the catalogue put first, which is the shop's own ordering.
      return eligible.slice(0, 3);
    }

    /* Cheapest thing that clears the line, first. Below that, the closest
       near-miss — a shopper UGX 12,000 short is better served by a UGX 9,000
       item than by a UGX 90,000 one, even though neither finishes the job. */
    return [...eligible]
      .sort((a, b) => {
        const aClears = a.price >= away;
        const bClears = b.price >= away;
        if (aClears !== bClears) return aClears ? -1 : 1;
        return aClears ? a.price - b.price : b.price - a.price;
      })
      .slice(0, 3);
  }, [products, excludeKey, away]);

  if (picks.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-shop-line pt-3">
      <p className="text-[13px] font-semibold text-shop-ink">
        {away > 0 ? (
          <>
            Add one of these and delivery is free
          </>
        ) : (
          <>Goes well with your order</>
        )}
      </p>

      {/* ---- A rail, not a stack ----

          These were full-width rows: a 44px thumbnail, the name, and an Add
          button, three of them down the foot of the drawer. That shape spends
          the drawer's scarcest resource — vertical space, directly above the
          checkout button — on three products it shows badly, because a 44px
          square is too small to be the reason anyone buys anything.

          As a rail the picture is roughly three times the area and the whole
          block is shorter. 38% of the track puts two and a half cards in view,
          and the half card is what says there are more: a row that ends flush
          with the edge reads as a row of two. */}
      <ul className="no-scrollbar -mx-4 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
        {picks.map((product) => (
          <li
            key={product.id}
            className="w-[38%] shrink-0 snap-start overflow-hidden rounded-lg border border-shop-line bg-white"
          >
            <div className="relative aspect-square w-full bg-white">
              {/* Guarded: an imageless product stores "" here, and `next/image`
                  treats an empty src as a request for the current page. */}
              {product.image && (
                <Image
                  quality={90}
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="38vw"
                  className="object-contain p-1"
                />
              )}
            </div>

            <div className="p-1.5">
              <p className="line-clamp-2 text-[12px] leading-tight text-shop-ink">
                {product.name}
              </p>
              <p className="price mt-0.5 text-[12.5px] text-shop-ink">
                {formatPrice(product.price)}
              </p>

              <button
                type="button"
                tabIndex={focusable ? 0 : -1}
                aria-label={`Add ${product.name} to cart`}
                onClick={() =>
                  addItem(
                    {
                      productId: product.id,
                      name: product.name,
                      price: product.price,
                      image: product.image,
                    },
                    1
                  )
                }
                className="mt-1.5 w-full rounded-full border border-shop-primary/40 py-1 text-[12px] font-bold text-shop-primary transition-colors hover:bg-shop-primary hover:text-white"
              >
                Add
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
