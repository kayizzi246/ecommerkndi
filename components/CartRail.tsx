"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { optionSummary, useCart } from "@/lib/cart";
import { useCommerceTerms } from "@/lib/commerce-terms";
import { formatPrice } from "@/lib/currency";
import QuantityStepper from "@/components/QuantityStepper";

/**
 * The basket, pinned down the right edge of the window while it has anything
 * in it, on the Temu model: the total and Checkout at the top, how far the
 * basket is from free delivery, then every line with its photo, options,
 * price and a quantity picker, and the payment promise at the foot.
 *
 * Desktop only. On a phone the bottom bar already carries the basket, and a
 * 200px column would take half the screen. Hidden on /cart, where the page
 * itself is the basket.
 *
 * It reserves its own width by putting `has-cart-rail` on <html>, which
 * globals.css turns into 200px of right padding on the body, so it never
 * covers the grid it sits beside. Styled by `.crail-*` in black-november.css.
 */
export default function CartRail() {
  const { items, count, subtotal, updateQuantity, removeItem } = useCart();
  const { freeDeliveryFrom } = useCommerceTerms();
  const pathname = usePathname();
  const show = count > 0 && pathname !== "/cart";

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("has-cart-rail", show);
    return () => root.classList.remove("has-cart-rail");
  }, [show]);

  if (!show) return null;

  const freeOn = freeDeliveryFrom > 0;
  const away = freeOn ? Math.max(0, freeDeliveryFrom - subtotal) : 0;
  const progress = freeOn ? Math.min(100, (subtotal / freeDeliveryFrom) * 100) : 0;

  return (
    <aside aria-label="Your cart" className="crail fixed bottom-0 right-0 top-0 z-50 hidden w-[200px] flex-col lg:flex">
      <div className="crail-head">
        <p className="crail-title">
          Your cart <span className="crail-count">{count}</span>
        </p>
        <p className="crail-label">Subtotal</p>
        <p className="price crail-total">{formatPrice(subtotal)}</p>

        {freeOn && (
          <div className="crail-free">
            <p>
              {away > 0 ? (
                <>
                  <strong>{formatPrice(away)}</strong> to free delivery
                </>
              ) : (
                <strong>Free delivery unlocked</strong>
              )}
            </p>
            <span className="crail-bar">
              <span style={{ width: `${progress}%` }} />
            </span>
          </div>
        )}

        <Link href="/checkout" className="crail-checkout">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path strokeLinecap="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Checkout
        </Link>
        <Link href="/cart" className="crail-view">
          View cart
        </Link>
      </div>

      <ul className="crail-items">
        {items.map((item) => {
          const options = optionSummary(item);
          return (
            <li key={item.key} className="crail-item">
              <div className="crail-photo">
                {item.image && (
                  <Image src={item.image} alt={item.name} fill sizes="168px" className="object-cover" quality={80} />
                )}
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  aria-label={`Remove ${item.name}`}
                  className="crail-remove close-x close-x-sm"
                >
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="price crail-price">{formatPrice(item.price * item.quantity)}</p>
              {options && <p className="crail-options">{options}</p>}
              <div className="crail-qty">
                <QuantityStepper
                  size="sm"
                  name={item.name}
                  quantity={item.quantity}
                  onChange={(quantity) => updateQuantity(item.key, quantity)}
                  onRemove={() => removeItem(item.key)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="crail-foot">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4.5 6v5.25c0 4.6 3.2 8.6 7.5 9.75 4.3-1.15 7.5-5.15 7.5-9.75V6L12 3Z" />
        </svg>
        Secure checkout · MoMo &amp; cards
      </p>
    </aside>
  );
}
