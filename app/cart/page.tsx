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
    name: "Express Shipping",
    fee: 12000,
    eta: "Get it tomorrow by 10:00 PM",
    note: "Order before 12 AM",
  },
  {
    id: "standard",
    name: "Standard Shipping",
    fee: 8000,
    eta: "Get it within 2–3 business days",
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
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const { notify } = useToast();

  // Shoppers tick the lines they want to check out, exactly as on BFL.
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

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="border border-bfl-line bg-white px-6 py-14">
          <svg className="mx-auto mb-4 h-16 w-16 text-[#dcdcdc]" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
          <h1 className="mb-2 text-[20px] font-bold text-black">Your cart is empty</h1>
          <p className="mb-8 text-[13px] text-bfl-grey">
            Discover this week&apos;s arrivals and find something you love.
          </p>
          <Link href="/" className="btn-bfl inline-block px-10 py-3.5 text-[14px]">
            Start shopping
          </Link>
        </div>
      </main>
    );
  }

  const allSelected = deselected.length === 0;

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 pb-24 md:px-8 lg:pb-12">
      <h1 className="mb-5 text-[24px] font-normal text-black">
        My Cart <span className="text-bfl-grey">({items.length} {items.length === 1 ? "Item" : "Items"})</span>
      </h1>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {/* Select-all bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border border-bfl-line bg-white px-4 py-3">
            <label className="flex cursor-pointer items-center gap-3 text-[14px] font-medium text-black">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setDeselected(allSelected ? items.map((item) => item.key) : [])}
                className="h-4 w-4 accent-bfl-yellow"
              />
              {selectedItems.length}/{items.length} Items Selected
            </label>

            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => notify("Saved for later ♥")}
                className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[#333] hover:text-black"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
                Save for later
              </button>
              <button
                type="button"
                onClick={() => {
                  selectedItems.forEach((item) => removeItem(item.key));
                  notify("Selected items removed");
                }}
                className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[#333] hover:text-bfl-red"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M9 7V5h6v2m-8 0 1 13h8l1-13" />
                </svg>
                Remove
              </button>
            </div>
          </div>

          {/* Lines */}
          {items.map((item) => {
            const selected = !deselected.includes(item.key);
            return (
              <div key={item.key} className="border border-bfl-line bg-white p-4">
                <div className="flex gap-4">
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
                    className="mt-1 h-4 w-4 shrink-0 accent-bfl-yellow"
                  />

                  <Link
                    href={`/products/${item.productId}`}
                    className="relative h-28 w-24 shrink-0 overflow-hidden bg-bfl-surface"
                  >
                    <Image src={item.image} alt={item.name} fill sizes="96px" className="object-contain p-2" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <Link
                        href={`/products/${item.productId}`}
                        className="text-[15px] font-bold text-black hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="text-[16px] font-bold text-bfl-red">{formatPrice(item.price)}</p>
                    </div>

                    {item.options && Object.keys(item.options).length > 0 && (
                      <p className="mt-3 text-[13px] text-[#333]">
                        {Object.entries(item.options).map(([key, value], index) => (
                          <span key={key}>
                            {index > 0 && <span className="mx-2 text-bfl-line">|</span>}
                            {key}: <span className="font-bold">{value}</span>
                          </span>
                        ))}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-[13px] text-[#333]">
                        Qty:
                        <select
                          value={item.quantity}
                          onChange={(event) => updateQuantity(item.key, Number(event.target.value))}
                          aria-label={`Quantity for ${item.name}`}
                          className="border border-bfl-line bg-white px-2 py-1.5 text-[13px] font-bold focus:border-black focus:outline-none"
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex items-center gap-4">
                        <span className="text-[13px] text-bfl-grey">
                          Line total{" "}
                          <span className="font-bold text-black">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            removeItem(item.key);
                            notify("Item removed");
                          }}
                          className="flex items-center gap-1.5 text-[13px] text-[#555] hover:text-bfl-red"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M9 7V5h6v2m-8 0 1 13h8l1-13" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Wishlist prompt */}
          <Link
            href="/#wishlist"
            className="flex items-center justify-center gap-2 border border-bfl-line bg-white py-4 text-[14px] font-medium text-[#333] hover:text-black"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
            Add more from wishlist
          </Link>

          {/* Delivery methods */}
          <section className="border border-bfl-line bg-white p-4">
            <h2 className="mb-3 text-[15px] font-bold text-black">Delivery Methods</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {DELIVERY_METHODS.map((option) => {
                const active = method === option.id;
                const away = FREE_DELIVERY_THRESHOLD - selectedSubtotal;
                return (
                  <label
                    key={option.id}
                    className={`cursor-pointer border p-3 transition-colors ${
                      active ? "border-black" : "border-bfl-line hover:border-[#b0b0b0]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="delivery-method"
                        checked={active}
                        onChange={() => setMethod(option.id)}
                        className="accent-black"
                      />
                      <span className="text-[13px] font-bold text-black">
                        {option.name}{" "}
                        <span className="font-normal text-bfl-grey">
                          ({option.fee === 0 ? "Free" : formatPrice(option.fee)})
                        </span>
                      </span>
                    </span>
                    <span className="mt-2 block text-[12px] text-[#444]">{option.eta}</span>
                    <span className="mt-0.5 block text-[11px] text-bfl-grey">{option.note}</span>
                    {option.fee > 0 && (
                      <span className="mt-1.5 block text-[12px] font-medium text-bfl-green">
                        {away > 0
                          ? `Only ${formatPrice(away)} away from free shipping`
                          : "Free shipping unlocked"}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* Order summary */}
        <aside className="border border-bfl-line bg-white lg:sticky lg:top-32">
          <h2 className="border-b border-bfl-line px-5 py-4 text-[17px] font-bold text-black">
            Order Summary
          </h2>

          <div className="px-5 py-4">
            <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#333]">
              Price details
            </p>

            <dl className="space-y-2.5 text-[14px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-bfl-grey">
                  Subtotal ({selectedCount} {selectedCount === 1 ? "Item" : "Items"})
                </dt>
                <dd className="font-bold text-black">{formatPrice(selectedSubtotal)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-bfl-grey">{chosenMethod.name}</dt>
                <dd className={shipping === 0 ? "font-bold text-bfl-green" : "font-bold text-black"}>
                  {shipping === 0 ? "Free" : formatPrice(shipping)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-bfl-line pt-4">
              <span className="text-[15px] font-bold text-black">
                Total <span className="text-[12px] font-normal text-bfl-grey">(Incl. VAT)</span>
              </span>
              <span className="text-[20px] font-bold text-black">{formatPrice(total)}</span>
            </div>

            {qualifiesFree && (
              <p className="mt-4 flex items-center gap-2 bg-[#e4f5e6] px-3 py-2.5 text-[13px] text-[#0a7a2f]">
                <span aria-hidden>🎉</span>
                You&apos;re saving {formatPrice(chosenMethod.fee)} on delivery.
              </p>
            )}

            <Link
              href="/checkout"
              aria-disabled={selectedItems.length === 0}
              className={`mt-4 block py-3.5 text-center text-[14px] font-bold uppercase tracking-wide ${
                selectedItems.length === 0
                  ? "pointer-events-none bg-[#e8e8e8] text-[#9a9a9a]"
                  : "btn-bfl"
              }`}
            >
              Checkout ({selectedCount})
            </Link>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#333]">
              {["Cash", "MTN MoMo", "Airtel Money", "Visa", "Mastercard"].map((label) => (
                <span key={label} className="border border-bfl-line px-2 py-1">
                  {label}
                </span>
              ))}
            </div>

            <p className="mt-4 text-[12px] leading-5 text-bfl-grey">
              Got a coupon or voucher code? You can apply it during payment.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
