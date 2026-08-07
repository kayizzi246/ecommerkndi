"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";

const labelClass = "mb-1.5 block text-[12px] font-medium text-shop-body";

export default function CheckoutPage() {
  const { items, count, subtotal, clearCart } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="mb-3 text-[26px] font-semibold text-shop-ink">Nothing to check out</h1>
        <p className="mb-8 text-[14px] text-shop-muted">Your cart is empty.</p>
        <Link href="/" className="btn-shop px-10 py-3.5 text-[14px]">
          Continue shopping
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

  /* Shared between the mobile disclosure and the desktop summary rail. */
  const summary = (
    <>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-shop-line bg-white">
              <Image src={item.image} alt={item.name} fill sizes="64px" className="object-contain p-1" />
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-500 px-1 text-[10px] font-semibold text-white">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] font-medium leading-snug text-shop-ink">
                {item.name}
              </p>
              {item.options && Object.keys(item.options).length > 0 && (
                <p className="mt-0.5 text-[12px] text-shop-muted">
                  {Object.entries(item.options)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
              )}
            </div>
            <span className="whitespace-nowrap text-[13px] font-medium text-shop-ink">
              {formatPrice(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-2.5 border-t border-shop-line pt-6 text-[14px]">
        <div className="flex items-baseline justify-between">
          <dt className="text-shop-body">Subtotal · {count} {count === 1 ? "item" : "items"}</dt>
          <dd className="font-medium text-shop-ink">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-shop-body">Shipping</dt>
          <dd className="text-[13px] text-shop-muted">Calculated at delivery</dd>
        </div>
      </dl>

      <div className="mt-5 flex items-baseline justify-between border-t border-shop-line pt-5">
        <span className="text-[15px] font-medium text-shop-ink">Total</span>
        <span className="flex items-baseline gap-2">
          <span className="text-[12px] uppercase text-shop-muted">UGX</span>
          <span className="text-[24px] font-semibold text-shop-ink">{formatPrice(subtotal)}</span>
        </span>
      </div>
      <p className="mt-1 text-right text-[12px] text-shop-muted">Including taxes</p>
    </>
  );

  return (
    <form onSubmit={handleSubmit} className="lg:grid lg:min-h-screen lg:grid-cols-2">
      {/* Mobile summary disclosure, as Shopify shows above the form. */}
      <details className="group border-y border-shop-line bg-shop-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2 text-[14px] text-shop-ink">
            Order summary
            <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span className="text-[18px] font-semibold text-shop-ink">{formatPrice(subtotal)}</span>
        </summary>
        <div className="px-4 pb-6">{summary}</div>
      </details>

      {/* Form column */}
      <div className="order-1 bg-white">
        <div className="mx-auto w-full max-w-[560px] px-4 py-10 md:px-8 lg:ml-auto lg:mr-0 lg:px-14">
          <nav className="mb-8 flex items-center gap-2 text-[12px] text-shop-muted">
            <Link href="/cart" className="hover:text-shop-ink">
              Cart
            </Link>
            <span aria-hidden>›</span>
            <span className="text-shop-ink">Information</span>
            <span aria-hidden>›</span>
            <span>Payment</span>
          </nav>

          <section>
            <h2 className="mb-4 text-[17px] font-semibold text-shop-ink">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
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
                  className="field-shop"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  className="field-shop"
                />
              </div>
            </div>
            <p className="mt-2.5 text-[12px] leading-5 text-shop-muted">
              We&apos;ll create your Kandi account with this email so you can track orders —
              you&apos;ll receive a link to set your password.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mb-4 text-[17px] font-semibold text-shop-ink">Delivery</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="first_name">
                  First name *
                </label>
                <input id="first_name" name="first_name" required className="field-shop" />
              </div>
              <div>
                <label className={labelClass} htmlFor="last_name">
                  Last name
                </label>
                <input id="last_name" name="last_name" className="field-shop" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="address_1">
                  Address *
                </label>
                <input
                  id="address_1"
                  name="address_1"
                  required
                  placeholder="Street, building, landmark…"
                  className="field-shop"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="city">
                  City / Town *
                </label>
                <input id="city" name="city" required placeholder="Kampala" className="field-shop" />
              </div>
              <div>
                <label className={labelClass} htmlFor="country">
                  Country / Region
                </label>
                <input
                  id="country"
                  value="Uganda"
                  readOnly
                  className="field-shop bg-shop-surface text-shop-muted"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="notes">
                  Delivery notes (optional)
                </label>
                <textarea id="notes" name="notes" rows={3} className="field-shop resize-y" />
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="mb-1 text-[17px] font-semibold text-shop-ink">Payment</h2>
            <p className="mb-4 text-[13px] text-shop-muted">
              All transactions are secure and encrypted.
            </p>

            <div className="overflow-hidden rounded-xl border border-shop-line">
              <label className="flex cursor-pointer items-start gap-3 border-b-0 bg-shop-surface p-5">
                <input
                  type="radio"
                  name="payment"
                  value="cod"
                  defaultChecked
                  className="mt-0.5 accent-shop-primary"
                />
                <span>
                  <span className="block text-[14px] font-medium text-shop-ink">
                    Cash on delivery
                  </span>
                  <span className="mt-1 block text-[13px] leading-5 text-shop-muted">
                    Pay with cash, MTN MoMo or Airtel Money when your order arrives.
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-lg border border-shop-sale/30 bg-[#fdeeeb] px-3 py-2.5 text-[13px] text-shop-sale"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-shop mt-6 w-full py-4 text-[15px]"
            >
              {submitting ? "Placing order…" : "Pay now"}
            </button>

            <p className="mt-8 border-t border-shop-line pt-5 text-[12px] text-shop-muted">
              By placing this order you agree to our terms of sale.
            </p>
          </section>
        </div>
      </div>

      {/* Summary rail — full-bleed grey panel, the Shopify checkout signature. */}
      <aside className="order-2 hidden border-l border-shop-line bg-shop-surface lg:block">
        <div className="sticky top-0 w-full max-w-[520px] px-14 py-10 lg:ml-0 lg:mr-auto">
          {summary}
        </div>
      </aside>
    </form>
  );
}
