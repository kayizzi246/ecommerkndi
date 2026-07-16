"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";

const inputClass =
  "w-full border-b border-gray-300 px-1 py-2.5 text-sm focus:outline-none focus:border-black transition-colors bg-transparent";
const labelClass =
  "block text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-1";

export default function CheckoutPage() {
  const { items, count, subtotal, clearCart } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-24 text-center">
        <h1 className="text-xl tracking-[0.3em] uppercase font-semibold mb-3">
          Nothing to check out
        </h1>
        <p className="text-sm text-gray-500 mb-8">Your bag is empty.</p>
        <Link
          href="/"
          className="inline-block bg-black text-white text-xs tracking-[0.25em] uppercase px-10 py-4 hover:bg-gray-800 transition-colors"
        >
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
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      <h1 className="text-xl md:text-2xl tracking-[0.3em] uppercase font-semibold mb-10">
        Checkout
      </h1>

      <form
        onSubmit={handleSubmit}
        className="grid gap-10 lg:grid-cols-[1fr_380px] items-start"
      >
        <div className="space-y-12 max-w-2xl">
          <section>
            <h2 className="text-sm tracking-[0.25em] uppercase font-semibold border-b border-gray-200 pb-4 mb-6">
              1 · Delivery details
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
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
                <p className="text-xs text-gray-500 mt-1.5">
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
                <textarea id="notes" name="notes" rows={3} className={`${inputClass} border`} />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm tracking-[0.25em] uppercase font-semibold border-b border-gray-200 pb-4 mb-6">
              2 · Payment method
            </h2>
            <label className="flex items-center gap-4 border border-black p-5 cursor-pointer">
              <input
                type="radio"
                name="payment"
                value="cod"
                defaultChecked
                className="accent-black"
              />
              <span>
                <span className="text-xs tracking-[0.2em] uppercase font-semibold block">
                  Cash on delivery
                </span>
                <span className="text-sm text-gray-500">
                  Pay with cash or mobile money when your order arrives.
                </span>
              </span>
            </label>
          </section>
        </div>

        <aside className="border border-gray-200 p-6 lg:sticky lg:top-40">
          <h2 className="text-sm tracking-[0.25em] uppercase font-semibold border-b border-gray-200 pb-4 mb-4">
            Order Summary
          </h2>
          <ul className="space-y-3 text-sm mb-5 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <li key={item.key} className="flex justify-between gap-3">
                <span className="text-gray-600 line-clamp-1">
                  {item.quantity} × {item.name}
                  {item.options &&
                    Object.entries(item.options)
                      .map(([k, v]) => ` (${k} ${v})`)
                      .join("")}
                </span>
                <span className="font-semibold whitespace-nowrap">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-gray-200 pt-4 mb-6">
            <span className="text-xs tracking-[0.2em] uppercase text-gray-600">
              Subtotal ({count})
            </span>
            <span className="font-bold">{formatPrice(subtotal)}</span>
          </div>

          {error && (
            <p className="border border-sale text-sale text-sm p-3 mb-5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black hover:bg-gray-800 disabled:opacity-60 disabled:cursor-wait text-white text-xs tracking-[0.25em] uppercase py-4 transition-colors"
          >
            {submitting ? "Placing order…" : "Place order"}
          </button>
          <p className="text-xs text-gray-400 mt-4 text-center">
            By placing this order you agree to our terms of sale.
          </p>
        </aside>
      </form>
    </main>
  );
}
