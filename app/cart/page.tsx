"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/currency";

const DELIVERY_METHODS = [
  {
    id: "express",
    name: "Express",
    fee: 12000,
    eta: "Tomorrow by 10:00 PM",
    note: "Order before 12 AM",
  },
  {
    id: "standard",
    name: "Standard",
    fee: 8000,
    eta: "2–3 business days",
    note: "Kampala and major towns",
  },
  {
    id: "collect",
    name: "Collect in store",
    fee: 0,
    eta: "Ready in 24 hours",
    note: "Pick up from our Kampala branch",
  },
];

const FREE_DELIVERY_THRESHOLD = 50000;

export default function CartPage() {
  const { items, updateQuantity, removeItem } = useCart();
  const { notify } = useToast();

  // Shoppers tick the lines they want to check out.
  const [deselected, setDeselected] = useState<string[]>([]);
  const [method, setMethod] = useState(DELIVERY_METHODS[1].id);

  const selectedItems = useMemo(
    () => items.filter((item) => !deselected.includes(item.key)),
    [items, deselected]
  );

  const selectedSubtotal = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const chosenMethod = DELIVERY_METHODS.find((option) => option.id === method)!;
  const qualifiesFree = selectedSubtotal >= FREE_DELIVERY_THRESHOLD;
  const shipping = qualifiesFree ? 0 : chosenMethod.fee;
  const total = selectedSubtotal + shipping;

  // Progress toward the free-delivery threshold, capped so the bar never overruns.
  const freeProgress = Math.min(100, (selectedSubtotal / FREE_DELIVERY_THRESHOLD) * 100);
  const away = Math.max(0, FREE_DELIVERY_THRESHOLD - selectedSubtotal);

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-shop-surface">
          <svg className="h-9 w-9 text-shop-muted" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
        </div>
        <h1 className="mb-3 text-[26px] font-semibold text-shop-ink">Your cart is empty</h1>
        <p className="mb-8 text-[14px] text-shop-muted">
          Discover this week&apos;s arrivals and find something you love.
        </p>
        <Link href="/" className="btn-shop px-10 py-3.5 text-[14px]">
          Continue shopping
        </Link>
      </main>
    );
  }

  const allSelected = deselected.length === 0;

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 pb-28 md:px-8 lg:pb-16">
      <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[28px] font-semibold text-shop-ink md:text-[32px]">Your cart</h1>
        <Link
          href="/"
          className="text-[13px] text-shop-body underline underline-offset-4 hover:text-shop-ink"
        >
          Continue shopping
        </Link>
      </div>

      {/* Free-delivery progress */}
      <div className="card-shop mb-6 px-5 py-4">
        <p className="text-[13px] text-shop-body">
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

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_364px]">
        <div>
          {/* Select-all bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shop-line pb-3">
            <label className="flex cursor-pointer items-center gap-3 text-[13px] text-shop-body">
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
              className="text-[13px] text-shop-muted underline underline-offset-4 hover:text-shop-sale"
            >
              Remove selected
            </button>
          </div>

          {/* Lines */}
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
                    <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        href={`/products/${item.productId}`}
                        className="text-[15px] font-medium leading-snug text-shop-ink hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="whitespace-nowrap text-[15px] font-semibold text-shop-ink">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>

                    {item.options && Object.keys(item.options).length > 0 && (
                      <p className="mt-1.5 text-[12px] text-shop-muted">
                        {Object.entries(item.options)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(" · ")}
                      </p>
                    )}

                    <p className="mt-1 text-[12px] text-shop-muted">
                      {formatPrice(item.price)} each
                    </p>

                    <div className="mt-auto flex flex-wrap items-center gap-4 pt-3">
                      <div className="flex items-center rounded-lg border border-shop-line">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={() => updateQuantity(item.key, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                          className="flex h-9 w-9 items-center justify-center text-[16px] text-shop-body hover:text-shop-ink disabled:text-[#c9c9c9]"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-[13px] font-semibold text-shop-ink">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          className="flex h-9 w-9 items-center justify-center text-[16px] text-shop-body hover:text-shop-ink"
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
                        className="text-[13px] text-shop-muted underline underline-offset-4 hover:text-shop-sale"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Delivery methods */}
          <section className="mt-8">
            <h2 className="mb-3 text-[15px] font-semibold text-shop-ink">Delivery method</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {DELIVERY_METHODS.map((option) => {
                const active = method === option.id;
                return (
                  <label
                    key={option.id}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                      active
                        ? "border-shop-primary bg-shop-primary-soft"
                        : "border-shop-line hover:border-[#c2c2c2]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="delivery-method"
                          checked={active}
                          onChange={() => setMethod(option.id)}
                          className="accent-shop-primary"
                        />
                        <span className="text-[13px] font-semibold text-shop-ink">
                          {option.name}
                        </span>
                      </span>
                      <span className="text-[13px] text-shop-body">
                        {option.fee === 0 ? "Free" : formatPrice(option.fee)}
                      </span>
                    </span>
                    <span className="mt-2 block text-[12px] text-shop-body">{option.eta}</span>
                    <span className="mt-0.5 block text-[11px] text-shop-muted">{option.note}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* Order summary */}
        <aside className="card-shop p-6 lg:sticky lg:top-32">
          <h2 className="text-[17px] font-semibold text-shop-ink">Order summary</h2>

          <dl className="mt-5 space-y-3 text-[14px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-shop-muted">
                Subtotal · {selectedCount} {selectedCount === 1 ? "item" : "items"}
              </dt>
              <dd className="font-medium text-shop-ink">{formatPrice(selectedSubtotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-shop-muted">{chosenMethod.name} delivery</dt>
              <dd className={shipping === 0 ? "font-medium text-shop-success" : "font-medium text-shop-ink"}>
                {shipping === 0 ? "Free" : formatPrice(shipping)}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex items-baseline justify-between border-t border-shop-line pt-5">
            <span className="text-[15px] font-semibold text-shop-ink">Total</span>
            <div className="text-right">
              <span className="block text-[22px] font-semibold text-shop-ink">
                {formatPrice(total)}
              </span>
              <span className="text-[11px] text-shop-muted">Incl. VAT</span>
            </div>
          </div>

          {qualifiesFree && (
            <p className="mt-4 rounded-lg bg-shop-successbg px-3 py-2.5 text-[12px] text-shop-success">
              You&apos;re saving {formatPrice(chosenMethod.fee)} on delivery.
            </p>
          )}

          <Link
            href="/checkout"
            aria-disabled={selectedItems.length === 0}
            className={`mt-5 block rounded-[10px] py-4 text-center text-[14px] font-semibold ${
              selectedItems.length === 0
                ? "pointer-events-none bg-[#d9d9d9] text-[#8f8f8f]"
                : "btn-shop w-full"
            }`}
          >
            Checkout · {formatPrice(total)}
          </Link>

          <p className="mt-3 text-center text-[12px] text-shop-muted">
            Coupons and vouchers are applied at payment.
          </p>

          <div className="mt-5 flex flex-wrap gap-1.5 border-t border-shop-line pt-5 text-[11px] text-shop-muted">
            {["Cash", "MTN MoMo", "Airtel Money", "Visa", "Mastercard"].map((label) => (
              <span key={label} className="rounded-md border border-shop-line px-2 py-1">
                {label}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
