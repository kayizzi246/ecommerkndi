"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/woocommerce";
import { formatPrice } from "@/lib/currency";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import VariantSheet, { type SheetIntent } from "@/components/VariantSheet";

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
  const [sheet, setSheet] = useState<SheetIntent | null>(null);
  const soldOut = product.stock_status === "outofstock";
  const frame = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { addItem } = useCart();
  const { notify } = useToast();

  const needsChoice = (product.attributes ?? []).some((attr) => attr.options.length > 0);

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

  /**
   * Add to cart, or open the sheet when there is something to choose.
   *
   * This used to scroll back up to the buy box in every case, which was the
   * safe thing to do but not a good one: the shopper had asked to buy and was
   * given a scroll. Now a plain product goes straight into the bag, and a
   * product with a size or a colour gets the pickers brought down to the thumb.
   */
  const act = (intent: SheetIntent) => {
    if (soldOut) return;

    if (needsChoice) {
      setSheet(intent);
      return;
    }

    addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
      },
      1
    );

    if (intent === "buy") {
      router.push("/checkout");
      return;
    }

    notify("Added to cart", { image: product.image, showBagLink: true });
  };

  return (
    <div
      ref={frame}
      // Kept mounted and translated out of view so it slides rather than
      // popping, and so screen readers are not handed a element that appears
      // and disappears from the tree as the page scrolls.
      /* Permanent on a phone, scroll-triggered on desktop.
         On mobile this bar replaces the bottom navigation entirely — the
         product page hides that — so buying is always one tap away and the
         thumb never has to travel. On a wide screen the real buy box is
         usually still on screen, so a permanent bar there would only cover
         the page for no gain. */
      className={`fixed inset-x-0 bottom-0 z-[60] border-t border-shop-line bg-white pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ${
        visible ? "translate-y-0" : "translate-y-0 lg:pointer-events-none lg:translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 md:gap-4 md:px-8 md:py-3">
        <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-shop-hairline sm:block">
          {product.image && (
            <Image src={product.image} alt="" fill sizes="48px" className="object-cover" />
          )}
        </div>

        {/* The name is desktop-only. On a phone the shopper is looking at the
            product; spending half the bar telling them what it is costs the
            buttons the room they need to be tappable. */}
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="line-clamp-1 text-[13.5px] text-shop-title">{product.name}</p>
          <p className="price text-[17px] leading-none text-shop-flame">
            {formatPrice(product.price)}
          </p>
        </div>

        <p className="price shrink-0 text-[17px] leading-none text-shop-flame sm:hidden">
          {formatPrice(product.price)}
        </p>

        {soldOut ? (
          <button disabled className="btn-shop flex-1 py-3 text-[14px] sm:flex-none sm:px-6">
            Sold out
          </button>
        ) : (
          <div className="flex flex-1 gap-2 sm:flex-none">
            <button
              type="button"
              onClick={() => act("cart")}
              className="btn-shop-outline flex-1 whitespace-nowrap px-4 py-3 text-[14px] sm:flex-none sm:px-6"
            >
              Add to cart
            </button>
            {/* Buy now carries the solid fill: of the two it is the one the
                shop wants taken, and two buttons of equal weight make the
                shopper choose between them instead of buying. */}
            <button
              type="button"
              onClick={() => act("buy")}
              className="btn-shop flex-1 whitespace-nowrap px-4 py-3 text-[14px] sm:flex-none sm:px-6"
            >
              Buy now
            </button>
          </div>
        )}
      </div>

      <VariantSheet product={product} intent={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
