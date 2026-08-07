"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";

/**
 * Side cart, modelled on the Next.js Commerce cart modal: a panel that slides
 * in from the right over a blurred scrim, with each line showing a bordered
 * thumbnail, a rounded quantity stepper, and a delete affordance pinned to the
 * image's top-left corner.
 *
 * The panel stays mounted so the slide transition can play in both directions;
 * it is inert (`pointer-events-none`, `aria-hidden`) while closed.
 */
const FREE_DELIVERY_THRESHOLD = 50000;

export default function CartDrawer() {
  const { items, count, subtotal, updateQuantity, removeItem, drawerOpen, closeDrawer } =
    useCart();

  const qualifiesFree = subtotal >= FREE_DELIVERY_THRESHOLD;
  const away = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const freeProgress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);

  // Escape closes, and the page behind the panel stops scrolling.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <div
      className={`fixed inset-0 z-[90] ${drawerOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!drawerOpen}
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close cart"
        tabIndex={drawerOpen ? 0 : -1}
        onClick={closeDrawer}
        className={`absolute inset-0 cursor-default bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${
          drawerOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal={drawerOpen}
        aria-label="Shopping cart"
        className={`absolute bottom-0 right-0 top-0 flex h-full w-full flex-col border-l border-shop-line bg-white/95 backdrop-blur-xl transition-transform duration-300 ease-in-out sm:w-[400px] ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <p className="text-[17px] font-semibold text-shop-ink">
            My cart{" "}
            {count > 0 && <span className="font-normal text-shop-muted">({count})</span>}
          </p>
          <button
            type="button"
            aria-label="Close cart"
            tabIndex={drawerOpen ? 0 : -1}
            onClick={closeDrawer}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-shop-line text-shop-ink transition-colors hover:bg-shop-surface"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="mt-16 flex flex-col items-center px-6 text-center">
            <svg className="h-16 w-16 text-shop-ink" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            <p className="mt-6 text-[22px] font-bold text-shop-ink">Your cart is empty.</p>
            <button
              type="button"
              onClick={closeDrawer}
              className="btn-shop mt-8 w-full py-3.5 text-[14px]"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <div className="flex h-full flex-col justify-between overflow-hidden px-6 pb-6">
            {/* Free-delivery progress — the single highest-leverage nudge in a
                side cart, and it is computed from the real subtotal. */}
            <div className="shrink-0 rounded-lg bg-shop-surface px-4 py-3">
              <p className="text-[12px] text-shop-body">
                {qualifiesFree ? (
                  <span className="font-semibold text-shop-success">
                    Your order ships free.
                  </span>
                ) : (
                  <>
                    Add{" "}
                    <span className="font-semibold text-shop-ink">{formatPrice(away)}</span> more
                    for free delivery.
                  </>
                )}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    qualifiesFree ? "bg-shop-success" : "bg-shop-ink"
                  }`}
                  style={{ width: `${freeProgress}%` }}
                />
              </div>
            </div>

            <ul className="grow overflow-auto py-2">
              {items.map((item) => (
                <li key={item.key} className="flex w-full flex-col border-b border-shop-line">
                  <div className="relative flex w-full flex-row justify-between gap-3 py-4">
                    {/* Delete pinned to the thumbnail corner. */}
                    <button
                      type="button"
                      aria-label={`Remove ${item.name} from cart`}
                      tabIndex={drawerOpen ? 0 : -1}
                      onClick={() => removeItem(item.key)}
                      className="absolute -ml-1.5 -mt-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-500 text-white transition-colors hover:bg-shop-sale"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                        <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>

                    <Link
                      href={`/products/${item.productId}`}
                      onClick={closeDrawer}
                      tabIndex={drawerOpen ? 0 : -1}
                      className="flex min-w-0 flex-row gap-3"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-shop-line bg-white">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="64px"
                          className="object-contain p-1"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="line-clamp-2 text-[14px] leading-tight text-shop-ink">
                          {item.name}
                        </span>
                        {item.options && Object.keys(item.options).length > 0 && (
                          <p className="mt-1 text-[12px] text-shop-muted">
                            {Object.entries(item.options)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </Link>

                    <div className="flex h-16 shrink-0 flex-col justify-between">
                      <p className="text-right text-[13px] font-semibold text-shop-ink">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                      <div className="ml-auto flex h-9 flex-row items-center rounded-full border border-shop-line">
                        <button
                          type="button"
                          aria-label={`Reduce quantity of ${item.name}`}
                          tabIndex={drawerOpen ? 0 : -1}
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          className="flex h-full w-8 items-center justify-center text-[15px] text-shop-body hover:text-shop-ink"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-[13px] text-shop-ink">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          tabIndex={drawerOpen ? 0 : -1}
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          className="flex h-full w-8 items-center justify-center text-[15px] text-shop-body hover:text-shop-ink"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="py-4 text-[13px] text-shop-muted">
              <div className="mb-3 flex items-center justify-between border-b border-shop-line pb-2">
                <p>Taxes</p>
                <p className="text-right text-[15px] text-shop-ink">Included</p>
              </div>
              <div className="mb-3 flex items-center justify-between border-b border-shop-line pb-2">
                <p>Shipping</p>
                <p className="text-right">Calculated at checkout</p>
              </div>
              <div className="mb-3 flex items-center justify-between border-b border-shop-line pb-2">
                <p>Total</p>
                <p className="text-right text-[15px] font-semibold text-shop-ink">
                  {formatPrice(subtotal)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href="/checkout"
                onClick={closeDrawer}
                tabIndex={drawerOpen ? 0 : -1}
                className="btn-shop block w-full rounded-full p-3.5 text-center text-[14px]"
              >
                Proceed to checkout
              </Link>
              <Link
                href="/cart"
                onClick={closeDrawer}
                tabIndex={drawerOpen ? 0 : -1}
                className="block w-full p-1 text-center text-[13px] text-shop-body underline underline-offset-4 hover:text-shop-ink"
              >
                View full cart
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
