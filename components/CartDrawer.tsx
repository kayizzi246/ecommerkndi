"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";
import { useCommerceTerms } from "@/lib/commerce-terms";
import DrawerAddOns from "@/components/cart/DrawerAddOns";

/**
 * Side cart, modelled on the Next.js Commerce cart modal: a panel that slides
 * in from the right over a blurred scrim, with each line showing a bordered
 * thumbnail, a rounded quantity stepper, and a delete affordance pinned to the
 * image's top-left corner.
 *
 * The panel stays mounted so the slide transition can play in both directions;
 * it is inert (`pointer-events-none`, `aria-hidden`) while closed.
 */
export default function CartDrawer() {
  const { items, count, subtotal, updateQuantity, removeItem, drawerOpen, closeDrawer } =
    useCart();

  /* The threshold from wp-admin, not the `const FREE_DELIVERY_THRESHOLD = 50000`
     that used to sit here. This drawer quotes the shopper a figure — "spend X
     more and delivery is free" — that the checkout then has to honour, and the
     checkout prices against `getDeliveryRates`, which reads the same setting.
     Two hardcoded copies of one number is a promise the basket can break. */
  const { freeDeliveryFrom } = useCommerceTerms();

  /* A shop that has switched the offer off (0) has no bar to draw and no
     shortfall to quote, so the whole block below is suppressed rather than
     dividing by zero and promising free delivery on everything. */
  const freeDeliveryOn = freeDeliveryFrom > 0;
  const qualifiesFree = freeDeliveryOn && subtotal >= freeDeliveryFrom;
  const away = freeDeliveryOn ? Math.max(0, freeDeliveryFrom - subtotal) : 0;
  const freeProgress = freeDeliveryOn
    ? Math.min(100, (subtotal / freeDeliveryFrom) * 100)
    : 0;

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
          <p className="text-[18px] font-semibold text-shop-ink">
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
            <p className="mt-6 text-[24px] font-semibold text-shop-ink">Your cart is empty.</p>
            <button
              type="button"
              onClick={closeDrawer}
              className="btn-shop mt-8 w-full py-3.5 text-[15px]"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          /* `justify-between` is gone. It was distributing the leftover space
             between four blocks, which was fine while three of them were fixed
             and one scrolled — and stopped being fine when the add-on rail
             arrived and started competing with the item list for the same
             height. On a phone the list lost, and the cart collapsed to a
             single visible row with everything else stacked under it.

             Flex sizing decides it now: the bar, the totals and the button are
             `shrink-0`, and the scroll region takes whatever is left. */
          <div className="flex h-full flex-col overflow-hidden px-6 pb-6">
            {/* Free-delivery progress — the single highest-leverage nudge in a
                side cart, and it is computed from the real subtotal against the
                real wp-admin threshold. Hidden entirely when the shop is not
                running the offer, rather than drawing an empty bar. */}
            {freeDeliveryOn && (
              <div className="shrink-0 rounded-lg bg-shop-surface px-4 py-3">
                <p className="text-[13px] text-shop-body">
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
                      qualifiesFree ? "bg-shop-success" : "bg-shop-primary"
                    }`}
                    style={{ width: `${freeProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* ---- One scroll region, holding the lines AND the add-ons ----

                 The rail used to sit outside this, between the list and the
                 totals, where it held a fixed slice of the drawer's height for
                 itself. Inside it, the cart lines get the full remaining
                 height and the suggestions scroll into view underneath them —
                 which is also the honest order: they are an afterthought to
                 the basket, not a permanent fixture above the total. */}
            <div className="grow overflow-auto">
            <ul className="py-2">
              {items.map((item) => (
                <li key={item.key} className="flex w-full flex-col border-b border-shop-line">
                  <div className="relative flex w-full flex-row justify-between gap-3 py-4">
                    {/* ---- Delete, pinned to the thumbnail corner ----
                         `left-0 top-3` rather than the `-ml-1.5 -mt-1.5` this
                         used to carry, which is what made the button look
                         sliced in half.

                         With no `left` or `top`, an absolutely positioned
                         element sits at its *static* position — here the start
                         of the flex row — and the negative margins then pulled
                         it 6px further left and up, outside the row entirely.
                         The scrolling `<ul>` around it is `overflow-auto`, so
                         everything outside its content box is clipped: the left
                         6px of every remove button was cut off, leaving a row of
                         half-circles down the side of the cart.

                         Anchoring it explicitly keeps the button on the corner
                         of the thumbnail and wholly inside the scroll container,
                         so nothing is clipped at any drawer width. */}
                    <button
                      type="button"
                      aria-label={`Remove ${item.name} from cart`}
                      tabIndex={drawerOpen ? 0 : -1}
                      onClick={() => removeItem(item.key)}
                      className="absolute left-0 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-500 text-white transition-colors hover:bg-shop-sale"
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
                        {/* Guarded: an imageless product stores "" here, and
                            `next/image` treats an empty src as a request for
                            the current page. */}
                        {item.image && (
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="64px"
                            quality={90}
                            className="object-contain p-1"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="line-clamp-2 text-[15px] leading-tight text-shop-ink">
                          {item.name}
                        </span>
                        {item.options && Object.keys(item.options).length > 0 && (
                          <p className="mt-1 text-[13px] text-shop-muted">
                            {Object.entries(item.options)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </Link>

                    <div className="flex h-16 shrink-0 flex-col justify-between">
                      <p className="text-right text-[14px] font-semibold text-shop-ink">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                      <div className="ml-auto flex h-9 flex-row items-center rounded-full border border-shop-line">
                        <button
                          type="button"
                          aria-label={`Reduce quantity of ${item.name}`}
                          tabIndex={drawerOpen ? 0 : -1}
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          className="flex h-full w-8 items-center justify-center text-[16px] text-shop-body hover:text-shop-ink"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-[14px] text-shop-ink">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          tabIndex={drawerOpen ? 0 : -1}
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          className="flex h-full w-8 items-center justify-center text-[16px] text-shop-body hover:text-shop-ink"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* ---- The answer to the bar at the top ----
                 The free-delivery panel above names a figure and stops there.
                 This row is what closes it: three one-tap items, ordered by how
                 neatly each one gets the basket over the line. It sits below the
                 lines and above the totals so it reads as part of the order
                 rather than as an advertisement stapled to the bottom. */}
            <DrawerAddOns
              subtotal={subtotal}
              freeDeliveryFrom={freeDeliveryFrom}
              excludeIds={items.map((item) => item.productId)}
              focusable={drawerOpen}
            />
            </div>

            {/* ---- Three facts, one rule ----

                 Every row carried its own bottom border, so the foot of the
                 drawer was four horizontal lines inside 80 pixels — the total
                 was boxed in by the two lines nearest it and read as no more
                 important than "Taxes". One rule above the total is enough to
                 separate the summary from the sum, and the total takes the
                 weight instead of a border. */}
            <div className="shrink-0 pb-4 pt-3 text-[14px] text-shop-muted">
              <div className="flex items-center justify-between py-1">
                <p>Taxes</p>
                <p className="text-shop-body">Included</p>
              </div>
              <div className="flex items-center justify-between py-1">
                <p>Shipping</p>
                <p className="text-shop-body">Calculated at checkout</p>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between border-t border-shop-line pt-3">
                <p className="text-[15px] font-semibold text-shop-ink">Total</p>
                <p className="price text-[19px] text-shop-ink">{formatPrice(subtotal)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href="/checkout"
                onClick={closeDrawer}
                tabIndex={drawerOpen ? 0 : -1}
                className="btn-shop block w-full rounded-full p-3.5 text-center text-[15px]"
              >
                Proceed to checkout
              </Link>
              <Link
                href="/cart"
                onClick={closeDrawer}
                tabIndex={drawerOpen ? 0 : -1}
                className="block w-full p-1 text-center text-[14px] text-shop-body underline underline-offset-4 hover:text-shop-ink"
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
