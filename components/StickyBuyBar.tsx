"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice } from "@/lib/currency";

/**
 * A buy bar that appears once the real Add to cart has scrolled out of view.
 *
 * On a product page the shopper spends most of their time below the fold —
 * reading the description, the specification table, the reviews — which is
 * exactly where the decision is made and exactly where the button is not. This
 * puts it back within reach without duplicating it on screen while the real one
 * is still visible.
 *
 * It watches the real button with an IntersectionObserver rather than a scroll
 * threshold, so it stays correct at any viewport height and after the page
 * reflows around a loaded image.
 *
 * "Add to cart" here scrolls back to the buy box rather than adding directly:
 * a product with a size or colour to choose cannot be added without those
 * choices, and a bar that silently added the wrong variant would cost more in
 * returns than it won in conversions.
 */
export default function StickyBuyBar({
  product,
  /** id of the element to watch — the real buy box. */
  watch,
}: {
  product: Product;
  watch: string;
}) {
  const [visible, setVisible] = useState(false);
  const soldOut = product.stock_status === "outofstock";
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(watch);
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Only show it once the buy box is above the viewport — not when the
        // shopper is still above it, near the top of the page.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [watch]);

  const jumpToBuyBox = () => {
    document.getElementById(watch)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div
      ref={frame}
      // Kept mounted and translated out of view so it slides rather than
      // popping, and so screen readers are not handed a element that appears
      // and disappears from the tree as the page scrolls.
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-[60] border-t border-shop-line bg-white pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ${
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 md:px-8">
        <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-shop-hairline sm:block">
          {product.image && (
            <Image src={product.image} alt="" fill sizes="48px" className="object-cover" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[13.5px] text-shop-title">{product.name}</p>
          <p className="price text-[17px] leading-none text-shop-flame">
            {formatPrice(product.price)}
          </p>
        </div>

        <button
          type="button"
          onClick={jumpToBuyBox}
          disabled={soldOut}
          tabIndex={visible ? 0 : -1}
          className="btn-shop shrink-0 px-6 py-3 text-[14px] disabled:cursor-not-allowed"
        >
          {soldOut ? "Sold out" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
