"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";

/**
 * The basket, pinned down the right edge of the window while it has anything
 * in it, on the Temu model: the subtotal, Checkout and Go to cart at the top,
 * then every line with its photo, price and a quantity picker.
 *
 * Desktop only. On a phone the bottom bar already carries the basket, and a
 * 200px column would take half the screen. Hidden on /cart, where the page
 * itself is the basket.
 *
 * It reserves its own width by putting `has-cart-rail` on <html>, which
 * globals.css turns into right padding on the body, so it never covers the
 * grid it sits beside.
 */
export default function CartRail() {
  const { items, count, subtotal, updateQuantity, removeItem } = useCart();
  const pathname = usePathname();
  const show = count > 0 && pathname !== "/cart";

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("has-cart-rail", show);
    return () => root.classList.remove("has-cart-rail");
  }, [show]);

  if (!show) return null;

  return (
    <aside
      aria-label="Your cart"
      className="cart-rail fixed bottom-0 right-0 top-0 z-50 hidden w-[200px] flex-col border-l border-shop-line bg-white lg:flex"
    >
      <div className="shrink-0 px-3 pb-3 pt-3">
        <p className="rounded-md bg-[#fb7701] px-3 py-1.5 text-center text-[14px] font-bold text-white">
          Subtotal
        </p>
        <p className="mt-2 text-center text-[19px] font-bold text-black">{formatPrice(subtotal)}</p>
        <Link
          href="/checkout"
          className="mt-3 block rounded-full bg-[#fb7701] py-2.5 text-center text-[15px] font-bold text-white transition-colors hover:bg-[#e56b00]"
        >
          Checkout ({count})
        </Link>
        <Link
          href="/cart"
          className="mt-2 block rounded-full border-2 border-black py-2 text-center text-[14px] font-bold text-black transition-colors hover:bg-black hover:text-white"
        >
          Go to cart
        </Link>
      </div>

      <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto border-t border-shop-line px-3 py-4">
        {items.map((item) => (
          <li key={item.key} className="text-center">
            <div className="relative mx-auto aspect-square w-full max-w-[150px] overflow-hidden rounded border border-shop-line bg-white">
              {item.image && (
                <Image src={item.image} alt={item.name} fill sizes="150px" className="object-contain" quality={80} />
              )}
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                aria-label={`Remove ${item.name}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-shop-muted ring-1 ring-black/10 hover:text-black"
              >
                <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-[14px] font-bold text-black">{formatPrice(item.price * item.quantity)}</p>
            <select
              aria-label={`Quantity of ${item.name}`}
              value={item.quantity}
              onChange={(event) => updateQuantity(item.key, Number(event.target.value))}
              className="mt-1 w-20 rounded border border-shop-line bg-white px-2 py-1 text-[13px]"
            >
              {Array.from({ length: Math.max(10, item.quantity) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </aside>
  );
}
