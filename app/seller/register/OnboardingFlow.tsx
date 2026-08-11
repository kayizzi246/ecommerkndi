"use client";

import Link from "next/link";
import { useState } from "react";
import { sellerApi, type Seller } from "@/lib/seller";
import { formatPrice } from "@/lib/currency";
import PesapalModal from "@/components/PesapalModal";
import VerifyEmailCard from "@/app/seller/VerifyEmailCard";

const CATEGORIES = [
  "Shoes & footwear",
  "Fashion & clothing",
  "Sportswear",
  "Kids & babies",
  "Bags & accessories",
  "Beauty & personal care",
  "Home & living",
  "Electronics & accessories",
];

const CITIES = ["Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu", "Mbale", "Elsewhere in Uganda"];

type Form = {
  store_name: string;
  category: string;
  city: string;
  owner_name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
};

const EMPTY: Form = {
  store_name: "",
  category: CATEGORIES[0],
  city: CITIES[0],
  owner_name: "",
  email: "",
  phone: "",
  password: "",
  confirm: "",
};

type Props = {
  registrationFee: number;
  commissionRate: number;
  payNumber: string;
  payName: string;
};

/**
 * Four-step seller sign-up, then a confirmation.
 *
 * Each step validates before it will advance, so a mistake is caught on the
 * screen that caused it rather than at the end. The account is only created
 * when the last step is submitted — abandoning halfway leaves nothing behind.
 *
 * The joining fee is charged for real on the confirmation screen, through
 * Pesapal, by mobile money or card. The old manual route — send the money to
 * this number and quote a reference — is kept behind a disclosure, because it
 * still works when Pesapal is not configured and some sellers prefer it.
 */
export default function OnboardingFlow({
  registrationFee,
  commissionRate,
  payNumber,
  payName,
}: Props) {
  const feeApplies = registrationFee > 0;

  const STEPS = [
    { key: "store", title: "Your store", blurb: "What shoppers will see" },
    { key: "you", title: "About you", blurb: "So we can reach you" },
    { key: "password", title: "Security", blurb: "Protect your account" },
    ...(feeApplies
      ? [{ key: "fee", title: "Joining fee", blurb: "One-off, and what it pays for" }]
      : []),
  ];

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Seller | null>(null);
  /**
   * The account exists but its email address is still unproven, so the code
   * screen stands between here and the confirmation. Registration already sent
   * the code; nothing else about the account works until it comes back.
   */
  const [verifying, setVerifying] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  /** Returns an error message for the current step, or null when it is valid. */
  const validate = (): string | null => {
    const current = STEPS[step].key;

    if (current === "store") {
      if (form.store_name.trim().length < 2) return "Give your store a name.";
      return null;
    }
    if (current === "you") {
      if (form.owner_name.trim().length < 2) return "Tell us your name.";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return "Enter a valid email address.";
      if (form.phone.replace(/\D/g, "").length < 9) return "Enter a phone number we can call.";
      return null;
    }
    if (current === "password") {
      if (form.password.length < 8) return "Choose a password of at least 8 characters.";
      if (form.password !== form.confirm) return "The two passwords do not match.";
      return null;
    }
    return null;
  };

  const next = () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setDirection("forward");
    setError(null);
    setStep((n) => Math.min(STEPS.length - 1, n + 1));
  };

  const back = () => {
    setDirection("back");
    setError(null);
    setStep((n) => Math.max(0, n - 1));
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { seller } = await sellerApi.register({
        store_name: form.store_name.trim(),
        owner_name: form.owner_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        city: form.city,
        category: form.category,
      });
      setCreated(seller);
      setVerifying(!seller.email_verified);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (created && verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px]">
          <VerifyEmailCard
            email={form.email.trim()}
            onVerified={() => setVerifying(false)}
          />
          <p className="mt-4 text-center text-[13px] text-shop-muted">
            Your store is saved — this only confirms we can reach you.
          </p>
        </div>
      </div>
    );
  }

  if (created) {
    return (
      <Done
        seller={created}
        registrationFee={registrationFee}
        payNumber={payNumber}
        payName={payName}
      />
    );
  }

  const isLast = step === STEPS.length - 1;
  const anim = direction === "forward" ? "step-in" : "step-in-back";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/sell" className="flex items-center gap-2 text-[15px] text-shop-body hover:text-shop-primary">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Sell with us
        </Link>
        <p className="text-[15px] text-shop-muted">
          Already selling?{" "}
          <Link href="/seller/login" className="font-semibold text-shop-primary hover:underline">
            Sign in
          </Link>
        </p>
      </header>

      <div className="mt-8 grid flex-1 gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ---- Progress rail ---- */}
        <aside>
          <ol className="flex gap-3 overflow-x-auto no-scrollbar lg:flex-col lg:gap-0 lg:overflow-visible">
            {STEPS.map((entry, index) => {
              const state = index < step ? "done" : index === step ? "active" : "todo";
              return (
                <li key={entry.key} className="flex shrink-0 items-start gap-3 lg:pb-6">
                  <div className="flex flex-col items-center self-stretch">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold transition-colors duration-300 ${
                        state === "done"
                          ? "bg-pop-green text-white"
                          : state === "active"
                            ? "bg-shop-primary text-white"
                            : "bg-shop-hairline text-shop-muted"
                      }`}
                    >
                      {state === "done" ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </span>
                    {index < STEPS.length - 1 && (
                      <span
                        className={`hidden w-0.5 flex-1 transition-colors duration-300 lg:block ${
                          index < step ? "bg-pop-green" : "bg-shop-hairline"
                        }`}
                      />
                    )}
                  </div>
                  <div className="hidden lg:block">
                    <p
                      className={`text-[15px] font-semibold ${
                        state === "todo" ? "text-shop-muted" : "text-shop-ink"
                      }`}
                    >
                      {entry.title}
                    </p>
                    <p className="text-[13px] text-shop-muted">{entry.blurb}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Mobile progress bar */}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-shop-hairline lg:hidden">
            <div
              className="h-full rounded-full bg-shop-primary transition-[width] duration-400 ease-out"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </aside>

        {/* ---- Step ---- */}
        <div>
          <div key={STEPS[step].key} className={anim}>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-shop-primary">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="mt-2 text-[21px] font-extrabold leading-tight text-shop-ink md:text-[19px]">
              {STEPS[step].key === "store" && "Let's name your store"}
              {STEPS[step].key === "you" && "Now, a bit about you"}
              {STEPS[step].key === "password" && "Secure your account"}
              {STEPS[step].key === "fee" && "One last thing: the joining fee"}
            </h1>

            <div className="mt-7 max-w-[560px]">
              {STEPS[step].key === "store" && (
                <div className="space-y-5">
                  <Field delay={0} label="Store name" hint="This is what shoppers see on every product you sell.">
                    <input
                      autoFocus
                      value={form.store_name}
                      onChange={(event) => set("store_name", event.target.value)}
                      placeholder="e.g. Kampala Kicks"
                      className="field-shop text-[16px]"
                    />
                  </Field>

                  <Field delay={1} label="What do you mostly sell?">
                    <select
                      value={form.category}
                      onChange={(event) => set("category", event.target.value)}
                      className="field-shop text-[16px]"
                    >
                      {CATEGORIES.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>

                  <Field delay={2} label="Where do you dispatch from?">
                    <select
                      value={form.city}
                      onChange={(event) => set("city", event.target.value)}
                      className="field-shop text-[16px]"
                    >
                      {CITIES.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>

                  {form.store_name.trim() && (
                    <div className="field-in rounded-xl border border-shop-line bg-white p-4">
                      <p className="text-[13px] font-semibold uppercase tracking-wide text-shop-muted">
                        Your store page will be
                      </p>
                      <p className="mt-1 break-all text-[15px] font-semibold text-shop-primary">
                        /sellers/{slugify(form.store_name)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {STEPS[step].key === "you" && (
                <div className="space-y-5">
                  <Field delay={0} label="Your name">
                    <input
                      autoFocus
                      value={form.owner_name}
                      onChange={(event) => set("owner_name", event.target.value)}
                      autoComplete="name"
                      className="field-shop text-[16px]"
                    />
                  </Field>

                  <Field delay={1} label="Email" hint="Where order alerts and payout confirmations go.">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => set("email", event.target.value)}
                      autoComplete="email"
                      className="field-shop text-[16px]"
                    />
                  </Field>

                  <Field delay={2} label="Phone" hint="We call this number to confirm your application.">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => set("phone", event.target.value)}
                      placeholder="07XX XXX XXX"
                      autoComplete="tel"
                      className="field-shop text-[16px]"
                    />
                  </Field>
                </div>
              )}

              {STEPS[step].key === "password" && (
                <div className="space-y-5">
                  <Field delay={0} label="Password" hint="At least 8 characters.">
                    <input
                      autoFocus
                      type="password"
                      value={form.password}
                      onChange={(event) => set("password", event.target.value)}
                      autoComplete="new-password"
                      className="field-shop text-[16px]"
                    />
                  </Field>

                  <Field delay={1} label="Confirm password">
                    <input
                      type="password"
                      value={form.confirm}
                      onChange={(event) => set("confirm", event.target.value)}
                      autoComplete="new-password"
                      className="field-shop text-[16px]"
                    />
                  </Field>

                  <PasswordMeter password={form.password} />
                </div>
              )}

              {STEPS[step].key === "fee" && (
                <FeeStep
                  registrationFee={registrationFee}
                  commissionRate={commissionRate}
                  storeName={form.store_name}
                />
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="field-in mt-5 max-w-[560px] rounded-xl bg-pop-red-soft px-4 py-3 text-[15px] font-medium text-pop-red"
              >
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {step > 0 && (
                <button type="button" onClick={back} className="btn-shop-outline px-7 py-3 text-[16px]">
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={isLast ? submit : next}
                disabled={submitting}
                className="btn-shop px-9 py-3 text-[16px]"
              >
                {submitting
                  ? "Creating your store…"
                  : isLast
                    ? "Create my store"
                    : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mirrors WordPress's `sanitize_title` closely enough to preview the URL. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** A labelled field that fades up, staggered behind the ones before it. */
function Field({
  label,
  hint,
  delay,
  children,
}: {
  label: string;
  hint?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <label className="field-in block" style={{ animationDelay: `${80 + delay * 70}ms` }}>
      <span className="mb-1.5 block text-[15px] font-semibold text-shop-ink">{label}</span>
      {hint && <span className="mb-2 block text-[13px] text-shop-muted">{hint}</span>}
      {children}
    </label>
  );
}

/** Length-and-variety meter. Guidance only — the server is the authority. */
function PasswordMeter({ password }: { password: string }) {
  const checks = [
    { label: "8 characters or more", ok: password.length >= 8 },
    { label: "A number", ok: /\d/.test(password) },
    { label: "An upper and a lower case letter", ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
  ];
  const score = checks.filter((check) => check.ok).length;

  return (
    <div className="field-in" style={{ animationDelay: "220ms" }}>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              index < score
                ? score === 3
                  ? "bg-pop-green"
                  : score === 2
                    ? "bg-shop-flame"
                    : "bg-pop-red"
                : "bg-shop-hairline"
            }`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {checks.map((check) => (
          <li
            key={check.label}
            className={`flex items-center gap-2 text-[14px] ${
              check.ok ? "text-pop-green" : "text-shop-muted"
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
              {check.ok ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              ) : (
                <circle cx="12" cy="12" r="8" />
              )}
            </svg>
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The joining fee, explained before anyone is asked to pay it. */
function FeeStep({
  registrationFee,
  commissionRate,
  storeName,
}: {
  registrationFee: number;
  commissionRate: number;
  storeName: string;
}) {
  const covers = [
    "Verifying you and your business, so every store here is a real one",
    "Setting up your store page, seller account and payout details",
    "A person reviewing your first listings — photos, descriptions, pricing",
    "Onboarding help through your first listing and your first payout",
  ];

  return (
    <div className="space-y-5">
      <div
        className="field-in rounded-2xl border-2 border-shop-primary bg-shop-primary-soft p-6"
        style={{ animationDelay: "60ms" }}
      >
        <p className="text-[14px] font-semibold uppercase tracking-wide text-shop-primary">
          One-off, never again
        </p>
        <p className="mt-1 text-[38px] font-semibold leading-none text-shop-primary">
          {formatPrice(registrationFee)}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-shop-body">
          Charged once when you join{storeName ? ` ${storeName} to Kandi` : ""}. There is no
          monthly fee, no listing fee and no payout fee — after this, the only cost is{" "}
          {commissionRate}% of what you actually sell.
        </p>
      </div>

      <div className="field-in" style={{ animationDelay: "140ms" }}>
        <p className="text-[16px] font-semibold text-shop-ink">What it pays for</p>
        <ul className="mt-3 space-y-2.5">
          {covers.map((item) => (
            <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-shop-body">
              <svg
                className="mt-1 h-4 w-4 shrink-0 text-pop-green"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="field-in rounded-xl border border-shop-line bg-white p-4 text-[15px] leading-relaxed text-shop-body"
        style={{ animationDelay: "220ms" }}
      >
        <p>
          <strong className="text-shop-ink">Nothing is charged right now.</strong> Create your
          store first — the next screen gives you the number to pay and a reference to quote. If
          we turn your application down, the fee is refunded in full.
        </p>
      </div>
    </div>
  );
}

/**
 * The joining fee, paid on the spot through Pesapal.
 *
 * Mobile money and card both open the same Pesapal window — it presents its own
 * method picker, so the two buttons are really one flow with the shopper's
 * expectation named on each.
 *
 * The manual "send money to this number and quote a reference" instructions are
 * kept underneath as the fallback, because they still work when Pesapal is not
 * configured on the shop, and because some sellers will prefer them.
 *
 * Payment is confirmed by Pesapal's IPN server-to-server, so a seller who closes
 * the window after paying is still marked paid.
 */
function FeePayment({
  seller,
  registrationFee,
  payNumber,
  payName,
}: {
  seller: Seller;
  registrationFee: number;
  payNumber: string;
  payName: string;
}) {
  const amount = seller.fee_amount || registrationFee;
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPayment = async () => {
    setStarting(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/pesapal/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: { kind: "seller-fee", sellerId: seller.id },
          amount,
          description: `KandiUg seller joining fee — ${seller.store_name}`.slice(0, 100),
          billing: {
            email_address: seller.email,
            phone_number: seller.phone,
            first_name: seller.owner_name,
          },
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.redirect_url) {
        setError(data?.error ?? "Could not open the payment window. Please try again.");
        return;
      }

      setPaymentUrl(data.redirect_url);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  };

  if (paid) {
    return (
      <div className="mt-7 rounded-2xl border-2 border-pop-green bg-pop-green-soft p-6 text-left">
        <p className="text-[15px] font-semibold text-pop-green">Joining fee paid</p>
        <p className="mt-1 text-[14px] leading-relaxed text-shop-body">
          Thank you. Your application goes to our team for approval — you can sign in and start
          adding products in the meantime.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7 rounded-2xl border-2 border-shop-flame bg-shop-primary-soft p-6 text-left">
      <p className="text-[14px] font-semibold uppercase tracking-wide text-shop-primary">
        Next: pay the joining fee
      </p>
      <p className="price mt-1 text-[22px] leading-none text-shop-flame">{formatPrice(amount)}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={startPayment}
          disabled={starting}
          className="btn-shop flex-1 py-3 text-[15px]"
        >
          {starting ? "Opening…" : "Pay by mobile money"}
        </button>
        <button
          type="button"
          onClick={startPayment}
          disabled={starting}
          className="btn-shop-outline flex-1 py-3 text-[15px]"
        >
          Pay by card
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13.5px] font-medium text-shop-sale">
          {error}
        </p>
      )}

      <details className="mt-5">
        <summary className="cursor-pointer text-[13.5px] font-semibold text-shop-body hover:text-shop-primary">
          Rather send the money yourself?
        </summary>
        <dl className="mt-3 space-y-2.5 text-[15px]">
          {payNumber ? (
            <>
              <Row label="Send to" value={payNumber} />
              {payName && <Row label="Registered name" value={payName} />}
            </>
          ) : (
            <p className="text-shop-body">
              Call us on the number in your approval email and we will confirm how to pay.
            </p>
          )}
          <Row label="Your reference" value={seller.fee_reference} mono />
        </dl>
        <p className="mt-3 text-[13.5px] leading-relaxed text-shop-body">
          Quote that reference so we can match your payment to your store. We confirm it by email,
          usually the same day.
        </p>
      </details>

      <PesapalModal
        url={paymentUrl}
        title={`Pay ${formatPrice(amount)}`}
        onClose={() => setPaymentUrl(null)}
        onDone={(outcome) => {
          setPaymentUrl(null);
          if (outcome.paid) {
            setPaid(true);
          } else {
            setError(
              outcome.cancelled
                ? "You cancelled the payment. You can pay whenever you are ready."
                : outcome.message || "The payment did not go through. Please try again."
            );
          }
        }}
      />
    </div>
  );
}

/** Confirmation, with the payment instructions the seller needs next. */
function Done({
  seller,
  registrationFee,
  payNumber,
  payName,
}: {
  seller: Seller;
  registrationFee: number;
  payNumber: string;
  payName: string;
}) {
  const feeDue = seller.fee_status === "unpaid" && registrationFee > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-[640px] flex-col justify-center px-4 py-12 md:px-8">
      <div className="rounded-2xl border border-shop-line bg-white p-8 text-center md:p-10">
        <span className="check-ring mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-pop-green-soft">
          <svg className="h-10 w-10 text-pop-green" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
            <path className="check-draw" strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </span>

        <h1 className="mt-5 text-[21px] font-extrabold leading-tight text-shop-ink">
          {seller.store_name} is created
        </h1>
        <p className="mx-auto mt-2 max-w-[42ch] text-[16px] leading-relaxed text-shop-body">
          You can sign in and start setting up now. Your listings go live once our team approves
          the store.
        </p>

        {feeDue && (
          <FeePayment
            seller={seller}
            registrationFee={registrationFee}
            payNumber={payNumber}
            payName={payName}
          />
        )}

        <Link href="/seller/login" className="btn-shop mt-7 w-full py-3.5 text-[16px]">
          Sign in to your dashboard
        </Link>
        <Link
          href="/seller-policies"
          className="mt-4 block text-[14px] font-semibold text-shop-muted hover:text-shop-primary"
        >
          Read the seller policies
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-shop-primary/15 pb-2">
      <dt className="text-shop-body">{label}</dt>
      <dd className={`font-semibold text-shop-ink ${mono ? "font-mono tracking-wide" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
