"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/currency";
import CartRecommendations from "@/components/cart/CartRecommendations";
import { useCommerceTerms } from "@/lib/commerce-terms";

export default function CartPage() {
  const { items, updateQuantity, removeItem } = useCart();
  const { notify } = useToast();

  // Shoppers tick the lines they want to check out.
  const [deselected, setDeselected] = useState<string[]>([]);

  const selectedItems = useMemo(
    () => items.filter((item) => !deselected.includes(item.key)),
    [items, deselected]
  );

  const selectedSubtotal = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  /* From wp-admin rather than a local constant — the same figure the checkout
     prices against, so the bar below cannot promise what the next page refuses.
     See `lib/commerce-terms.tsx`. */
  const { freeDeliveryFrom } = useCommerceTerms();
  const freeDeliveryOn = freeDeliveryFrom > 0;

  const qualifiesFree = freeDeliveryOn && selectedSubtotal >= freeDeliveryFrom;

  // No delivery figure here on purpose. The real fee is charged per kilometre
  // from the shop, and it cannot be known until the shopper shares their
  // location at checkout — so the cart shows goods only rather than quoting a
  // number the next page would contradict.
  const total = selectedSubtotal;

  // Progress toward the free-delivery threshold, capped so the bar never overruns.
  const freeProgress = freeDeliveryOn
    ? Math.min(100, (selectedSubtotal / freeDeliveryFrom) * 100)
    : 0;
  const away = freeDeliveryOn ? Math.max(0, freeDeliveryFrom - selectedSubtotal) : 0;

  if (items.length === 0) {
    return (
      /* The empty state takes the canvas as well. It is the same page and a
         shopper reaches it by removing their last line, so a white screen here
         after a tinted one a moment ago reads as a navigation error rather than
         as an empty basket. */
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-shop-surface">
          <svg className="h-9 w-9 text-shop-muted" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
        </div>
        <h1 className="mb-3 section-title text-[20px] text-shop-ink">Your cart is empty</h1>
        <p className="mb-8 text-[15px] text-shop-muted">
          Discover this week&apos;s arrivals and find something you love.
        </p>
        <Link href="/" className="btn-shop px-10 py-3.5 text-[15px]">
          Continue shopping
        </Link>
      </main>
    );
  }

  const allSelected = deselected.length === 0;

  return (
    /* ---- The cart joins the shop's canvas-and-panels system ----

       This was a centred column laid straight onto the white page, with the
       free-delivery meter and the order summary drawn as `card-shop` boxes and
       the line items as a bare `divide-y` list. That was coherent when every
       page in the shop was white; the storefront's ground is a warm canvas now
       and its blocks are panels, so a white cart with two hand-rolled cards on
       it read as a page from the previous design.

       `<main>` takes the canvas and stops being the centred container — a
       ground has to reach both edges of the window, and this element was capped
       at 1200px, so tinting it would have left two white margins down the sides.
       The centring moves to the div inside it, which is what the homepage does
       for the same reason. */
    <main className="pb-28 lg:pb-16">
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="section-title text-[21px] text-shop-ink md:text-[26px]">Your cart</h1>
        <Link
          href="/"
          className="text-[14px] text-shop-body underline underline-offset-4 hover:text-shop-ink"
        >
          Continue shopping
        </Link>
      </div>

      {/* Free-delivery progress. Suppressed rather than drawn empty when the
          shop is not running a free-delivery offer at all. */}
      {freeDeliveryOn && (
        /* The shop panel rather than `card-shop`, which was this page's own
           idea of a box: a different radius and a different border from the
           twelve shelves on the homepage. One class across the shop means the
           cart cannot drift away from the storefront again. */
        <div className="shop-panel mb-6">
          <p className="text-[14px] text-shop-body">
            {qualifiesFree ? (
              <span className="font-semibold text-shop-success">
                Nice — your order ships free.
              </span>
            ) : (
              <>
                You&apos;re{" "}
                <span className="font-semibold text-shop-ink">{formatPrice(away)}</span> away from
                free delivery.
              </>
            )}
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-shop-surface">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                qualifiesFree ? "bg-shop-success" : "bg-shop-primary"
              }`}
              style={{ width: `${freeProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_364px]">
        <div>
          {/* Select-all bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shop-line pb-3">
            <label className="flex cursor-pointer items-center gap-3 text-[14px] text-shop-body">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setDeselected(allSelected ? items.map((item) => item.key) : [])}
                className="h-4 w-4 rounded accent-shop-primary"
              />
              {selectedItems.length} of {items.length} selected
            </label>

            <button
              type="button"
              onClick={() => {
                selectedItems.forEach((item) => removeItem(item.key));
                notify("Selected items removed");
              }}
              className="text-[14px] text-shop-muted underline underline-offset-4 hover:text-shop-sale"
            >
              Remove selected
            </button>
          </div>

          {/* The lines get a panel of their own, so the basket reads as one
              object rather than as a list floating on the page beside a boxed
              summary — which is what it looked like once the page took a
              ground. The select-all bar above is inside it for the same
              reason: it is a control over these lines, not over the page. */}
          <ul className="divide-y divide-shop-line">
            {items.map((item) => {
              const selected = !deselected.includes(item.key);
              return (
                <li key={item.key} className="flex gap-4 py-5">
                  <input
                    type="checkbox"
                    checked={selected}
                    aria-label={`Include ${item.name} in checkout`}
                    onChange={() =>
                      setDeselected((current) =>
                        selected
                          ? [...current, item.key]
                          : current.filter((key) => key !== item.key)
                      )
                    }
                    className="mt-1 h-4 w-4 shrink-0 rounded accent-shop-primary"
                  />

                  <Link
                    href={`/products/${item.productId}`}
                    className="relative h-[112px] w-24 shrink-0 overflow-hidden rounded-xl bg-shop-surface"
                  >
                    {/* Guarded: an imageless product stores "" here, and
                        `next/image` treats an empty src as a request for the
                        current page. */}
                    {item.image && (
                      <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" quality={90} />
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        href={`/products/${item.productId}`}
                        className="text-[16px] font-medium leading-snug text-shop-ink hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="whitespace-nowrap text-[16px] font-semibold text-shop-ink">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>

                    {item.options && Object.keys(item.options).length > 0 && (
                      <p className="mt-1.5 text-[13px] text-shop-muted">
                        {Object.entries(item.options)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(" · ")}
                      </p>
                    )}

                    <p className="mt-1 text-[13px] text-shop-muted">
                      {formatPrice(item.price)} each
                    </p>

                    <div className="mt-auto flex flex-wrap items-center gap-4 pt-3">
                      <div className="flex items-center rounded-lg border border-shop-line">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={() => updateQuantity(item.key, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                          className="flex h-9 w-9 items-center justify-center text-[17px] text-shop-body hover:text-shop-ink disabled:text-[#c9c9c9]"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-[14px] font-semibold text-shop-ink">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          className="flex h-9 w-9 items-center justify-center text-[17px] text-shop-body hover:text-shop-ink"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          removeItem(item.key);
                          notify("Item removed");
                        }}
                        className="text-[14px] text-shop-muted underline underline-offset-4 hover:text-shop-sale"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <CartRecommendations excludeIds={items.map((item) => item.productId)} />
        </div>

        {/* Order summary */}
        {/* The summary is the second panel on the page and the one that has
            to look like the end of a process. `lg:sticky` is unchanged — it
            follows the shopper down a long basket so the total and the checkout
            button are never scrolled away from. */}
        <aside className="shop-panel lg:sticky lg:top-32">
          <h2 className="text-[18px] font-extrabold text-shop-ink">Order summary</h2>

          <dl className="mt-5 space-y-3 text-[15px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-shop-muted">
                Subtotal · {selectedCount} {selectedCount === 1 ? "item" : "items"}
              </dt>
              <dd className="font-medium text-shop-ink">{formatPrice(selectedSubtotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-shop-muted">Delivery</dt>
              <dd
                className={
                  qualifiesFree
                    ? "font-medium text-shop-success"
                    : "text-right text-[13px] text-shop-muted"
                }
              >
                {qualifiesFree ? "Free" : "Calculated at checkout"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex items-baseline justify-between border-t border-shop-line pt-5">
            <span className="text-[16px] font-semibold text-shop-ink">Total</span>
            <div className="text-right">
              <span className="block text-[21px] font-semibold text-shop-ink">
                {formatPrice(total)}
              </span>
              <span className="text-[12px] text-shop-muted">Incl. VAT</span>
            </div>
          </div>

          {qualifiesFree && (
            <p className="mt-4 rounded-lg bg-shop-successbg px-3 py-2.5 text-[13px] text-shop-success">
              This order qualifies for free delivery.
            </p>
          )}

          <Link
            href="/checkout"
            aria-disabled={selectedItems.length === 0}
            className={`mt-5 block rounded-[10px] py-4 text-center text-[15px] font-semibold ${
              selectedItems.length === 0
                ? "pointer-events-none bg-[#d9d9d9] text-[#8f8f8f]"
                : "btn-shop w-full"
            }`}
          >
            Checkout · {formatPrice(total)}
          </Link>

          <p className="mt-3 text-center text-[13px] text-shop-muted">
            Coupons and vouchers are applied at payment.
          </p>

          <div className="mt-5 flex flex-wrap gap-1.5 border-t border-shop-line pt-5 text-[12px] text-shop-muted">
            {["Cash", "MTN MoMo", "Airtel Money", "Visa", "Mastercard"].map((label) => (
              <span key={label} className="rounded-md border border-shop-line px-2 py-1">
                {label}
              </span>
            ))}
          </div>
        </aside>
      </div>

      {/* ---- Sticky checkout, phones only ----
           The summary card above sits at the bottom of the page on a phone,
           below every line item — so on a cart of any size the one button that
           matters is off screen for the whole visit. This keeps it in the
           thumb's reach with the figure attached, because a checkout button
           without a total makes people scroll back up to check before they
           trust it.

           The bottom navigation hides itself on this route, so nothing is
           stacked underneath. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-shop-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-shop-muted">
              {selectedItems.length} {selectedItems.length === 1 ? "item" : "items"}
            </p>
            <p className="price text-[18px] leading-none text-shop-ink">{formatPrice(total)}</p>
          </div>

          <Link
            href="/checkout"
            aria-disabled={selectedItems.length === 0}
            className={`shrink-0 rounded-[10px] px-8 py-3.5 text-center text-[15px] font-semibold ${
              selectedItems.length === 0
                ? "pointer-events-none bg-[#d9d9d9] text-[#8f8f8f]"
                : "btn-shop"
            }`}
          >
            Checkout
          </Link>
        </div>
      </div>
      </div>
    </main>
  );
}
