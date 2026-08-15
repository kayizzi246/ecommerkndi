"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";
import PesapalModal from "@/components/PesapalModal";
import DeliveryPicker, { type DeliveryResult } from "@/components/DeliveryPicker";
import { saveAddress } from "@/lib/saved-addresses";
import { MtnMark, AirtelMark, VisaMark, MastercardMark } from "@/components/PaymentMarks";

const labelClass = "mb-1.5 block text-[13px] font-medium text-shop-body";

type PaymentValue = "cod" | "mobile" | "card";

const PAYMENT_METHODS: {
  value: PaymentValue;
  label: string;
  hint: string;
  viaPesapal: boolean;
}[] = [
  {
    value: "mobile",
    label: "Mobile money",
    hint: "MTN MoMo or Airtel Money. Pay now and we pack immediately.",
    viaPesapal: true,
  },
  {
    value: "card",
    label: "Visa / Mastercard",
    hint: "Pay securely by debit or credit card.",
    viaPesapal: true,
  },
  {
    value: "cod",
    label: "Cash on delivery",
    hint: "Pay with cash when your order arrives.",
    viaPesapal: false,
  },
];

export default function CheckoutPage() {
  const { items, count, subtotal, clearCart } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentValue>("mobile");
  /** Pesapal's payment URL while the modal is open. */
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  /** The WooCommerce order awaiting payment, so we can route on success. */
  const [pendingOrder, setPendingOrder] = useState<{ id: number; total: number } | null>(null);
  const [pesapalReady, setPesapalReady] = useState(true);
  /** Priced by the server from the shopper's location; null until they pick one. */
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null);

  /**
   * The four fields the location picker can fill in.
   *
   * Controlled, unlike the rest of the form, because sharing a location has to
   * be able to write into them — an uncontrolled input cannot be typed into
   * from outside. They stay fully editable: a reverse-geocoded street is a
   * guess, and the shopper knows their own gate.
   */
  const [addressFields, setAddressFields] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address_1: "",
    city: "",
  });

  const setField = (name: keyof typeof addressFields) => (value: string) =>
    setAddressFields((current) => ({ ...current, [name]: value }));

  const deliveryFee = delivery?.deliverable ? delivery.fee : 0;
  const total = subtotal + deliveryFee;

  // Whether the shop can take card / mobile money at all. Asked once, so the
  // unavailable options are visibly disabled rather than failing on submit.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/pesapal/status")
      .then((response) => response.json())
      .then((data: { enabled?: boolean }) => {
        if (cancelled) return;
        const enabled = Boolean(data.enabled);
        setPesapalReady(enabled);
        if (!enabled) setMethod("cod");
      })
      .catch(() => {
        if (!cancelled) setPesapalReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="mb-3 text-[21px] font-extrabold text-shop-ink">Nothing to check out</h1>
        <p className="mb-8 text-[15px] text-shop-muted">Your cart is empty.</p>
        <Link href="/" className="btn-shop px-10 py-3.5 text-[15px]">
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

    if (!delivery) {
      setError("Add your delivery location so we can work out the cost.");
      setSubmitting(false);
      return;
    }
    if (!delivery.deliverable) {
      setError("We do not deliver that far yet. Try an address closer to Kampala.");
      setSubmitting(false);
      return;
    }

    const viaPesapal = method !== "cod";

    try {
      // The order is created in WooCommerce first, either way. For a card or
      // mobile money order it is created `pending` — so the amount Pesapal
      // charges is the total WooCommerce calculated, not a figure the browser
      // supplied, and an abandoned payment leaves a visible unpaid order rather
      // than nothing at all.
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
          payment_method: method,
          awaiting_payment: viaPesapal,
          // The point, not the price: the server re-quotes from it, so a
          // tampered fee cannot reach the order.
          delivery_point: delivery.point,
          delivery_place: delivery.place ?? delivery.label,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Remembered only now the store has accepted the order — an address that
      // failed validation is not one worth offering back next time. Saved
      // before the payment step, deliberately: an abandoned payment still tells
      // us where this shopper lives.
      saveAddress({
        label: delivery.place ?? delivery.label,
        street: customer.address_1,
        city: customer.city,
        point: delivery.point,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
      });

      if (!viaPesapal) {
        clearCart();
        router.push(`/order-received?id=${data.id}&total=${data.total}`);
        return;
      }

      const payment = await fetch("/api/payments/pesapal/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the order number goes over the wire. The amount and the billing
        // details used to travel with it, and every one of them was thrown away
        // at the other end: WordPress already holds the order, so it reads the
        // real total and the real buyer from WooCommerce rather than trusting a
        // browser to state its own price. Sending them anyway invited the
        // reading that the two ends disagreed about the payload.
        body: JSON.stringify({ purpose: { kind: "order", orderId: data.id } }),
      });

      const paymentData = await payment.json().catch(() => null);

      if (!payment.ok || !paymentData?.redirect_url) {
        // Three different failures used to arrive as one sentence. They need
        // different answers, and the shopper cannot pick the right one from
        // "the payment window would not open":
        //
        //   • the payment service said no      → its own words, which usually
        //                                        name the problem
        //   • nothing came back as JSON        → the service is down or the
        //                                        request never reached it
        //
        // Either way the order is saved, so cash on delivery is still open to
        // them and nothing has been lost.
        setError(
          paymentData?.error ??
            `The payment service did not respond (error ${payment.status}). ` +
              "Your order is saved — try again, or choose cash on delivery."
        );
        // Logged as a string, not an object. The console collapsed the object
        // to a bare `{}` in the screenshots that came back, which hid the one
        // field worth reading.
        console.error(
          `[kandi-store] pesapal start returned ${payment.status} — ` +
            `code=${paymentData?.code ?? "none"} ` +
            `upstream=${paymentData?.upstream_status ?? "none"} ` +
            `message=${paymentData?.error ?? "(no JSON body)"}`
        );
        return;
      }

      setPendingOrder({ id: data.id, total: data.total });
      setPaymentUrl(paymentData.redirect_url);
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
              {/* Guarded: an imageless product stores "" here, and `next/image`
                  treats an empty src as a request for the current page. */}
              {item.image && (
                <Image src={item.image} alt={item.name} fill sizes="64px" className="object-contain p-1" />
              )}
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-500 px-1 text-[11px] font-semibold text-white">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[14px] font-medium leading-snug text-shop-ink">
                {item.name}
              </p>
              {item.options && Object.keys(item.options).length > 0 && (
                <p className="mt-0.5 text-[13px] text-shop-muted">
                  {Object.entries(item.options)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
              )}
            </div>
            <span className="whitespace-nowrap text-[14px] font-medium text-shop-ink">
              {formatPrice(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-2.5 border-t border-shop-line pt-6 text-[15px]">
        <div className="flex items-baseline justify-between">
          <dt className="text-shop-body">Subtotal · {count} {count === 1 ? "item" : "items"}</dt>
          <dd className="font-medium text-shop-ink">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-shop-body">Delivery</dt>
          <dd className="text-[14px]">
            {!delivery ? (
              <span className="text-shop-muted">Add your location</span>
            ) : !delivery.deliverable ? (
              <span className="text-shop-sale">Outside our area</span>
            ) : delivery.free ? (
              <span className="font-semibold text-shop-success">Free</span>
            ) : (
              <span className="font-medium text-shop-ink">{formatPrice(deliveryFee)}</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-baseline justify-between border-t border-shop-line pt-5">
        <span className="text-[16px] font-medium text-shop-ink">Total</span>
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] uppercase text-shop-muted">UGX</span>
          <span className="text-[20px] font-semibold text-shop-ink">{formatPrice(total)}</span>
        </span>
      </div>
      <p className="mt-1 text-right text-[13px] text-shop-muted">Including taxes</p>
    </>
  );

  return (
    <form onSubmit={handleSubmit} className="lg:grid lg:min-h-screen lg:grid-cols-2">
      {/* Mobile summary disclosure, as Shopify shows above the form. */}
      <details className="group border-y border-shop-line bg-shop-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2 text-[15px] text-shop-ink">
            Order summary
            <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span className="text-[20px] font-semibold text-shop-ink">{formatPrice(subtotal)}</span>
        </summary>
        <div className="px-4 pb-6">{summary}</div>
      </details>

      {/* Form column */}
      <div className="order-1 bg-white">
        <div className="mx-auto w-full max-w-[560px] px-4 py-10 md:px-8 lg:ml-auto lg:mr-0 lg:px-14">
          <nav className="mb-8 flex items-center gap-2 text-[13px] text-shop-muted">
            <Link href="/cart" className="hover:text-shop-ink">
              Cart
            </Link>
            <span aria-hidden>›</span>
            <span className="text-shop-ink">Information</span>
            <span aria-hidden>›</span>
            <span>Payment</span>
          </nav>

          <section>
            <h2 className="mb-4 text-[18px] font-extrabold text-shop-ink">Contact</h2>
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
                  value={addressFields.phone}
                  onChange={(event) => setField("phone")(event.target.value)}
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
            <p className="mt-2.5 text-[13px] leading-5 text-shop-muted">
              We&apos;ll create your Kandi account with this email so you can track orders —
              you&apos;ll receive a link to set your password.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="mb-4 text-[18px] font-extrabold text-shop-ink">Delivery</h2>

            {/* Priced before the shopper pays, not after. "Calculated at
                delivery" is the line that loses carts. */}
            <div className="mb-5">
              <DeliveryPicker
                subtotal={subtotal}
                value={delivery}
                onChange={setDelivery}
                onAutofill={(parts) =>
                  setAddressFields((current) => ({
                    ...current,
                    // Blank parts are skipped rather than written: reverse
                    // geocoding often knows the suburb and not the road, and
                    // clearing a street the shopper typed would be a step back.
                    address_1: parts.street || current.address_1,
                    city: parts.city || current.city,
                    first_name: parts.first_name || current.first_name,
                    last_name: parts.last_name || current.last_name,
                    phone: parts.phone || current.phone,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="first_name">
                  First name *
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  required
                  value={addressFields.first_name}
                  onChange={(event) => setField("first_name")(event.target.value)}
                  className="field-shop"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="last_name">
                  Last name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  value={addressFields.last_name}
                  onChange={(event) => setField("last_name")(event.target.value)}
                  className="field-shop"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="address_1">
                  Address *
                </label>
                <input
                  id="address_1"
                  name="address_1"
                  required
                  value={addressFields.address_1}
                  onChange={(event) => setField("address_1")(event.target.value)}
                  placeholder="Street, building, landmark…"
                  className="field-shop"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="city">
                  City / Town *
                </label>
                <input
                  id="city"
                  name="city"
                  required
                  value={addressFields.city}
                  onChange={(event) => setField("city")(event.target.value)}
                  placeholder="Kampala"
                  className="field-shop"
                />
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
            <h2 className="mb-1 text-[18px] font-extrabold text-shop-ink">Payment</h2>
            <p className="mb-4 text-[14px] text-shop-muted">
              All transactions are secure and encrypted.
            </p>

            <div className="divide-y divide-shop-line overflow-hidden rounded-xl border border-shop-line">
              {PAYMENT_METHODS.map((option) => {
                const active = method === option.value;
                // Card and mobile money both run through Pesapal; they are
                // listed separately because that is how a shopper thinks about
                // paying, and the Pesapal window opens on the right tab either
                // way.
                const unavailable = option.viaPesapal && !pesapalReady;

                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 p-5 transition-colors ${
                      active ? "bg-shop-primary-soft" : "bg-white"
                    } ${unavailable ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={option.value}
                      checked={active}
                      disabled={unavailable}
                      onChange={() => setMethod(option.value)}
                      className="mt-0.5 accent-shop-flame"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-medium text-shop-ink">
                          {option.label}
                        </span>
                        {/* The networks this option actually takes, in place of
                            the "PESAPAL" badge that used to sit here. Pesapal is
                            the processor, not something a shopper is choosing —
                            what they need to know is whether their MoMo line or
                            their card works. */}
                        {option.value === "mobile" && (
                          <>
                            <MtnMark />
                            <AirtelMark />
                          </>
                        )}
                        {option.value === "card" && (
                          <>
                            <VisaMark />
                            <MastercardMark />
                          </>
                        )}
                      </span>
                      <span className="mt-1 block text-[14px] leading-5 text-shop-muted">
                        {unavailable ? "Not available on this shop yet." : option.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-lg border border-shop-sale/30 bg-[#fdeeeb] px-3 py-2.5 text-[14px] text-shop-sale"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-shop mt-6 w-full py-4 text-[16px]"
            >
              {submitting ? "Placing order…" : "Pay now"}
            </button>

            <p className="mt-8 border-t border-shop-line pt-5 text-[13px] text-shop-muted">
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

      {/* The Pesapal payment window. The order already exists in WooCommerce by
          the time this opens, so closing it early loses nothing — the IPN
          settles the payment whatever the shopper's browser does. */}
      <PesapalModal
        url={paymentUrl}
        title={`Pay ${formatPrice(pendingOrder?.total ?? subtotal)}`}
        onClose={() => {
          setPaymentUrl(null);
          setError(
            "Payment window closed. Your order is saved as unpaid — you can pay again from your orders."
          );
        }}
        onDone={(outcome) => {
          setPaymentUrl(null);

          if (outcome.paid) {
            clearCart();
            router.push(
              `/order-received?id=${outcome.orderId ?? pendingOrder?.id ?? ""}&total=${
                pendingOrder?.total ?? subtotal
              }`
            );
            return;
          }

          setError(
            outcome.cancelled
              ? "You cancelled the payment. Your order is saved as unpaid."
              : outcome.message || "The payment did not go through. Please try again."
          );
        }}
      />
    </form>
  );
}
