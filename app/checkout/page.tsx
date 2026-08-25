"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";
import PesapalModal from "@/components/PesapalModal";
import TurnstileWidget from "@/components/TurnstileWidget";
import DeliveryPicker, { type DeliveryResult } from "@/components/DeliveryPicker";
import { saveAddress } from "@/lib/saved-addresses";
import { MtnMark, AirtelMark, VisaMark, MastercardMark } from "@/components/PaymentMarks";
import { codZoneFor } from "@/lib/cod-zones";
import { isUgPhone, formatUgPhone } from "@/lib/phone";
import { useCommerceTerms } from "@/lib/commerce-terms";

const labelClass = "mb-1 block text-[13.5px] font-semibold text-shop-ink";

/** The grey line under a field that says what to put in it. */
const hintClass = "mt-1 text-[12.5px] leading-4 text-shop-muted";

/**
 * A field that failed, in red, under the field that failed.
 *
 * Deliberately not a summary at the top of the form. A shopper who has filled
 * in nine boxes and is told "please check your details" has to find the one
 * that is wrong themselves, and on a phone the summary is off screen by the
 * time they are looking at the box.
 */
function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 flex items-start gap-1 text-[12.5px] font-medium leading-4 text-shop-sale">
      <span aria-hidden>!</span>
      <span>{children}</span>
    </p>
  );
}

/** The step number beside a section heading. */
function StepHeading({ step, title, sub }: { step: number; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2.5 text-[18px] font-extrabold text-shop-ink">
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-shop-ink text-[12px] font-bold text-white"
        >
          {step}
        </span>
        {title}
      </h2>
      {sub && <p className="mt-1.5 text-[13.5px] leading-5 text-shop-muted">{sub}</p>}
    </div>
  );
}

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
    hint: "Pay the rider in cash when your order arrives.",
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
   * The Turnstile token, and the counter that asks for a fresh one.
   *
   * Null is the normal state on a shop that has not configured Turnstile — the
   * widget renders nothing and the server passes the request through. See
   * `components/TurnstileWidget.tsx`.
   *
   * `turnstileNonce` is bumped after every submit because Cloudflare accepts a
   * token exactly once. Without it, a shopper whose first attempt failed for
   * any reason — a wrong phone number, a declined card — would send a spent
   * token on their second and be told they were a robot.
   */
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileNonce, setTurnstileNonce] = useState(0);

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

  /**
   * Which fields the shopper has finished with, so a half-typed phone number is
   * not called wrong while they are still typing it.
   *
   * Validation on blur and then live once a field has been touched is the
   * pattern that annoys nobody: nothing is red before it has been attempted,
   * and once it has, the error clears the moment it is fixed rather than on
   * the next submit.
   */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (name: string) => () =>
    setTouched((current) => ({ ...current, [name]: true }));

  const setField = (name: keyof typeof addressFields) => (value: string) =>
    setAddressFields((current) => ({ ...current, [name]: value }));

  const deliveryFee = delivery?.deliverable ? delivery.fee : 0;
  const total = subtotal + deliveryFee;

  /* ---- The last free-delivery nudge, and the only one that costs money ----

     The product page, the side cart and `/cart` all quote this shortfall. The
     checkout — the one screen where the shopper is looking at a real delivery
     charge, in shillings, against their own address — did not, so the moment a
     fee is most likely to be resented was the moment the shop stopped
     mentioning that it was avoidable.

     Both figures come from wp-admin through `useCommerceTerms`, the same
     setting `getDeliveryRates` prices against on the server, so the line below
     cannot promise a threshold the quote will not honour. */
  const { freeDeliveryFrom } = useCommerceTerms();
  const freeDeliveryShortfall =
    freeDeliveryFrom > 0 && subtotal < freeDeliveryFrom
      ? freeDeliveryFrom - subtotal
      : 0;
  /* Only once there IS a fee on screen. Shown before the address is entered it
     is a hypothetical; shown beside "UGX 8,000" it is an offer. */
  const showFreeDeliveryNudge =
    freeDeliveryShortfall > 0 && Boolean(delivery?.deliverable) && deliveryFee > 0;

  const phoneValid = isUgPhone(addressFields.phone);
  const phoneError = touched.phone && addressFields.phone.trim() !== "" && !phoneValid;

  /**
   * Cash on delivery, decided by where the parcel is going.
   *
   * Read from the delivery COORDINATE rather than the typed city — see
   * `lib/cod-zones.ts` — so the answer here is the same one the server will
   * reach when the order is posted. The two must never disagree: a shopper
   * offered cash on delivery and then refused it at submit has been told the
   * shop cannot make up its mind.
   */
  const codZone = codZoneFor(delivery?.point);
  const codAllowed = Boolean(codZone);

  /* ---- The payment method the shopper has, as opposed to the one they picked ----
   *
   * Moving the pin out of a cash-on-delivery area silently changes what the
   * shop can accept, so the selection has to follow the address rather than
   * waiting to fail on submit. Falling back to mobile money rather than card
   * because it is what most of this shop pays with.
   *
   * DERIVED, not corrected in an effect. It used to be a `useEffect` that
   * called `setMethod("mobile")` when the chosen method stopped being
   * available, which React's linter flags — and rightly: it renders once with
   * the impossible selection, sets state, and renders again. On this screen
   * that first render is a moment where "Cash on delivery" is visibly selected
   * in an area that cannot have it, and any code reading `method` in between —
   * a submit landing on exactly that frame — sees the wrong value.
   *
   * Computing it during render removes the window entirely. `method` remains
   * what the shopper actually clicked, so that when they move the pin back into
   * a COD area their original choice returns rather than having been
   * overwritten. */
  const effectiveMethod: PaymentValue =
    method === "cod" && !codAllowed && pesapalReady ? "mobile" : method;

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

    /* The rider calls this number to deliver the order, so a number that cannot
       be called is an order that cannot be delivered. Checked again on the
       server, which is the copy that counts — see `/api/checkout`. */
    if (!isUgPhone(customer.phone)) {
      setTouched((current) => ({ ...current, phone: true }));
      setError(
        "Check your phone number — it should be a Ugandan mobile like 0772 123 456. " +
          "The rider calls it to deliver your order."
      );
      setSubmitting(false);
      return;
    }

    /* Cash on delivery outside its areas. The option is disabled in the form,
       so reaching here means the address changed after it was picked — which is
       exactly the case that would otherwise post a COD order the shop does not
       accept. */
    if (effectiveMethod === "cod" && !codAllowed) {
      setError(
        "Cash on delivery is not available in your area. " +
          "Choose mobile money or card for this address."
      );
      setSubmitting(false);
      return;
    }

    const viaPesapal = effectiveMethod !== "cod";

    try {
      // The order is created in WooCommerce first, either way. For a card or
      // mobile money order it is created `pending` — so the amount Pesapal
      // charges is the total WooCommerce calculated, not a figure the browser
      // supplied, and an abandoned payment leaves a visible unpaid order rather
      // than nothing at all.
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          /* One key per ATTEMPT, so the server can tell "the shopper pressed the
             button again" from "the request never arrived and the browser
             resent it". Both look identical over the wire and only one of them
             should produce a second order — see `lib/idempotency.ts`. Minted
             here rather than once per session, because two deliberate orders in
             a row are two orders and must not collapse into one. */
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          customer,
          items: items.map(({ productId, variationId, quantity, options }) => ({
            productId,
            // Which variation, not just which words. Without it WooCommerce
            // prices the order from the parent product and moves the parent's
            // stock — see `lib/variation-match.ts`.
            variationId,
            quantity,
            options,
          })),
          payment_method: effectiveMethod,
          // Null on a shop with no Turnstile keys, where the server does not
          // ask for one either.
          turnstile_token: turnstileToken,
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
        body: JSON.stringify({
          purpose: { kind: "order", orderId: data.id },
          /* Proof that this browser is the one that placed the order.
             `/api/payments/pesapal/start` used to accept a bare order id, and
             WooCommerce order ids are sequential — so a loop could open a
             payment against any order in the shop and read that buyer's name,
             email, phone and address out of the quote that came back. The token
             was minted by `/api/checkout` a moment ago; see
             `lib/checkout-token.ts`. */
          token: data.payment_token,
        }),
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
      // Cloudflare accepts a Turnstile token exactly once, so the widget is
      // reset whatever happened. A shopper correcting a phone number and
      // pressing the button again must not be handed back a token their browser
      // has already spent — that failure reads as "the shop thinks I am a
      // robot" with nothing they can do about it.
      setTurnstileToken(null);
      setTurnstileNonce((current) => current + 1);
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

      {/* The delivery fee, and how to stop paying it.
          Deliberately a link back to the cart rather than to the shop front: the
          shopper has a basket open and is one item short, so the useful
          destination is the page that shows them what they already have with
          suggestions beside it — not the homepage, which throws away the
          context and reads like being sent back to the start. */}
      {showFreeDeliveryNudge && (
        <Link
          href="/cart"
          className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-shop-successbg px-3.5 py-2.5 text-[13.5px] leading-snug text-shop-body transition-colors hover:bg-shop-surface"
        >
          <span>
            Add{" "}
            <strong className="font-semibold text-shop-ink">
              {formatPrice(freeDeliveryShortfall)}
            </strong>{" "}
            more and this delivery is free.
          </span>
          <span className="shrink-0 font-semibold text-shop-success underline underline-offset-4">
            Add items
          </span>
        </Link>
      )}

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
            <StepHeading
              step={1}
              title="How we reach you"
              sub="The rider calls before delivering, so this has to be a number you answer."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="phone">
                  Phone number <span className="text-shop-sale">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  /* `inputMode` rather than only `type`: it is what puts the
                     number pad up on a phone, which is most of this shop. */
                  inputMode="tel"
                  autoComplete="tel"
                  value={addressFields.phone}
                  onChange={(event) => setField("phone")(event.target.value)}
                  onBlur={markTouched("phone")}
                  aria-invalid={phoneError || undefined}
                  aria-describedby="phone-hint"
                  placeholder="0772 123 456"
                  className={`field-shop ${phoneError ? "border-shop-sale" : ""}`}
                />
                {phoneError ? (
                  <FieldError>
                    Ugandan mobile numbers start 07 and have 10 digits — like 0772 123 456.
                  </FieldError>
                ) : (
                  <p id="phone-hint" className={hintClass}>
                    {phoneValid
                      ? `We'll call ${formatUgPhone(addressFields.phone)}`
                      : "MTN or Airtel. We call this number to deliver."}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="email">
                  Email <span className="font-normal text-shop-muted">(optional)</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-describedby="email-hint"
                  className="field-shop"
                />
                <p id="email-hint" className={hintClass}>
                  For your receipt and order tracking. We&apos;ll send a link to set a
                  password so you can follow the order.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <StepHeading
              step={2}
              title="Where we deliver it"
              sub="Drop a pin or type a landmark — we price the delivery from it straight away."
            />

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
                  First name <span className="text-shop-sale">*</span>
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  value={addressFields.first_name}
                  onChange={(event) => setField("first_name")(event.target.value)}
                  onBlur={markTouched("first_name")}
                  placeholder="Sarah"
                  aria-describedby="first_name-hint"
                  className={`field-shop ${
                    touched.first_name && !addressFields.first_name.trim()
                      ? "border-shop-sale"
                      : ""
                  }`}
                />
                {touched.first_name && !addressFields.first_name.trim() ? (
                  <FieldError>We need a name for the rider to ask for.</FieldError>
                ) : (
                  <p id="first_name-hint" className={hintClass}>
                    Who is receiving the parcel.
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="last_name">
                  Last name <span className="font-normal text-shop-muted">(optional)</span>
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  autoComplete="family-name"
                  value={addressFields.last_name}
                  onChange={(event) => setField("last_name")(event.target.value)}
                  placeholder="Nakato"
                  className="field-shop"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="address_1">
                  Street, building or landmark <span className="text-shop-sale">*</span>
                </label>
                <input
                  id="address_1"
                  name="address_1"
                  required
                  autoComplete="street-address"
                  value={addressFields.address_1}
                  onChange={(event) => setField("address_1")(event.target.value)}
                  onBlur={markTouched("address_1")}
                  placeholder="Plot 12 Bukoto Street, blue gate opposite Shell"
                  aria-describedby="address_1-hint"
                  className={`field-shop ${
                    touched.address_1 && !addressFields.address_1.trim()
                      ? "border-shop-sale"
                      : ""
                  }`}
                />
                {touched.address_1 && !addressFields.address_1.trim() ? (
                  <FieldError>
                    Tell the rider where to stop — a road and a landmark is enough.
                  </FieldError>
                ) : (
                  /* Naming the landmark in the hint rather than only in the
                     placeholder: half of Kampala has no numbered street, and
                     "opposite the mosque" is what actually gets a parcel to a
                     gate. A placeholder disappears the moment anyone types. */
                  <p id="address_1-hint" className={hintClass}>
                    A nearby landmark helps most — &ldquo;next to Cafe Javas, green gate&rdquo;.
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="city">
                  Town or suburb <span className="text-shop-sale">*</span>
                </label>
                <input
                  id="city"
                  name="city"
                  required
                  autoComplete="address-level2"
                  value={addressFields.city}
                  onChange={(event) => setField("city")(event.target.value)}
                  onBlur={markTouched("city")}
                  placeholder="Muyenga"
                  aria-describedby="city-hint"
                  className={`field-shop ${
                    touched.city && !addressFields.city.trim() ? "border-shop-sale" : ""
                  }`}
                />
                {touched.city && !addressFields.city.trim() ? (
                  <FieldError>Which town or suburb?</FieldError>
                ) : (
                  <p id="city-hint" className={hintClass}>
                    Kampala, Wakiso, Entebbe…
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="country">
                  Country
                </label>
                <input
                  id="country"
                  value="Uganda"
                  readOnly
                  aria-describedby="country-hint"
                  className="field-shop bg-shop-surface text-shop-muted"
                />
                <p id="country-hint" className={hintClass}>
                  We deliver within Uganda only.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="notes">
                  Anything the rider should know{" "}
                  <span className="font-normal text-shop-muted">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="Call when you reach the gate. Deliver after 5pm."
                  aria-describedby="notes-hint"
                  className="field-shop resize-y"
                />
                <p id="notes-hint" className={hintClass}>
                  Gate codes, a better time to come, or who to hand it to.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <StepHeading
              step={3}
              title="How you pay"
              sub="All transactions are secure and encrypted."
            />

            <div className="divide-y divide-shop-line overflow-hidden rounded-xl border border-shop-line">
              {PAYMENT_METHODS.map((option) => {
                const active = effectiveMethod === option.value;
                // Card and mobile money both run through Pesapal; they are
                // listed separately because that is how a shopper thinks about
                // paying, and the Pesapal window opens on the right tab either
                // way.
                //
                // Cash on delivery has a second gate, and it is a place rather
                // than a setting: the shop only carries cash to a few
                // neighbourhoods. The radio is disabled outside them rather
                // than hidden, because a missing option looks like a bug and a
                // disabled one with a reason under it is an answer — and it is
                // the difference between a shopper choosing mobile money and a
                // shopper abandoning the cart to go and look for the option
                // they had last time.
                const unavailable =
                  (option.viaPesapal && !pesapalReady) ||
                  (option.value === "cod" && !codAllowed);

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
                        {option.value === "cod"
                          ? codAllowed
                            ? `Available at this address. ${option.hint}`
                            : "Not available in your area."
                          : unavailable
                            ? "Not available on this shop yet."
                            : option.hint}
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

            {/* Renders nothing at all unless the shop has set
                NEXT_PUBLIC_TURNSTILE_SITE_KEY, and in Cloudflare's managed mode
                most shoppers never see more than a moment's spinner. Placed
                above the button rather than below it so a challenge that does
                appear is not off the bottom of a phone screen. */}
            <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileNonce} />

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
