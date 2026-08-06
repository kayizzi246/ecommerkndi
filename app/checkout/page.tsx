"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";

const inputClass =
  "w-full border border-bfl-line bg-white px-3 py-2.5 text-[14px] transition-colors focus:border-black focus:outline-none";
const labelClass = "mb-1.5 block text-[12px] font-bold text-[#333]";

export default function CheckoutPage() {
  const { items, count, subtotal, clearCart } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-[1440px] px-4 py-24 text-center">
        <h1 className="mb-3 text-[24px] font-bold text-black">Nothing to check out</h1>
        <p className="mb-8 text-[13px] text-bfl-grey">Your cart is empty.</p>
        <Link href="/" className="btn-bfl inline-block px-10 py-3.5 text-[14px]">
          Start shopping
        </Link>
      </main>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const customer = {
      first_name: String(form.get("first_name") ?? ""),
      last_name: String(form.get("last_name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      address_1: String(form.get("address_1") ?? ""),
      city: String(form.get("city") ?? ""),
      notes: String(form.get("notes") ?? ""),
      country: "UG",
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          items: items.map(({ productId, quantity, options }) => ({
            productId,
            quantity,
            options,
          })),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      clearCart();
      router.push(`/order-received?id=${data.id}&total=${data.total}`);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
      <h1 className="mb-8 text-[26px] font-normal text-black">Checkout</h1>

      <form
        onSubmit={handleSubmit}
        className="grid gap-10 lg:grid-cols-[1fr_380px] items-start"
      >
        <div className="max-w-2xl space-y-8">
          <section className="border border-bfl-line bg-white p-6">
            <h2 className="mb-6 border-b border-bfl-line pb-4 text-[16px] font-bold text-black">
              1. Delivery details
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="first_name">
                  First name *
                </label>
                <input id="first_name" name="first_name" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="last_name">
                  Last name
                </label>
                <input id="last_name" name="last_name" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="phone">
                  Phone number *
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="07xx xxx xxx"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="email">
                  Email
                </label>
                <input id="email" name="email" type="email" className={inputClass} />
                <p className="mt-1.5 text-[12px] text-bfl-grey">
                  We&apos;ll automatically create your Kandi account with this
                  email so you can track orders — you&apos;ll receive a link to
                  set your password.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="address_1">
                  Delivery address *
                </label>
                <input
                  id="address_1"
                  name="address_1"
                  required
                  placeholder="Street, building, landmark…"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="city">
                  City / Town *
                </label>
                <input id="city" name="city" required placeholder="Kampala" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="notes">
                  Order notes (optional)
                </label>
                <textarea id="notes" name="notes" rows={3} className={inputClass} />
              </div>
            </div>
          </section>

          <section className="border border-bfl-line bg-white p-6">
            <h2 className="mb-6 border-b border-bfl-line pb-4 text-[16px] font-bold text-black">
              2. Payment method
            </h2>
            <label className="flex cursor-pointer items-center gap-4 border-2 border-black p-5">
              <input type="radio" name="payment" value="cod" defaultChecked className="accent-black" />
              <span>
                <span className="block text-[14px] font-bold text-black">Cash on delivery</span>
                <span className="text-[13px] text-bfl-grey">
                  Pay with cash, MTN MoMo or Airtel Money when your order arrives.
                </span>
              </span>
            </label>
          </section>
        </div>

        <aside className="border border-bfl-line bg-white p-6 lg:sticky lg:top-40">
          <h2 className="mb-4 border-b border-bfl-line pb-4 text-[16px] font-bold text-black">
            Order summary
          </h2>
          <ul className="mb-5 max-h-64 space-y-3 overflow-y-auto text-[13px]">
            {items.map((item) => (
              <li key={item.key} className="flex justify-between gap-3">
                <span className="line-clamp-1 text-[#555]">
                  {item.quantity} × {item.name}
                  {item.options &&
                    Object.entries(item.options)
                      .map(([k, v]) => ` (${k} ${v})`)
                      .join("")}
                </span>
                <span className="whitespace-nowrap font-bold text-black">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mb-6 flex items-baseline justify-between border-t border-bfl-line pt-4">
            <span className="text-[14px] font-bold text-black">Subtotal ({count})</span>
            <span className="text-[20px] font-bold text-black">{formatPrice(subtotal)}</span>
          </div>

          {error && (
            <p role="alert" className="mb-5 border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[13px] text-[#a51f1f]">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-bfl w-full py-4 text-[14px]">
            {submitting ? "Placing order…" : "Place order"}
          </button>
          <p className="mt-4 text-center text-[12px] text-bfl-grey">
            By placing this order you agree to our terms of sale.
          </p>
        </aside>
      </form>
    </main>
  );
}
