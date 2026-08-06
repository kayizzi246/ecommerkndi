"use client";

import Link from "next/link";
import { useState } from "react";
import { sellerApi } from "@/lib/seller";

const CATEGORIES = [
  "Fashion & clothing",
  "Shoes & footwear",
  "Sportswear",
  "Kids & babies",
  "Home & living",
  "Beauty & personal care",
  "Electronics & accessories",
];

type Form = {
  store_name: string;
  owner_name: string;
  email: string;
  phone: string;
  city: string;
  category: string;
  password: string;
  confirm: string;
};

const EMPTY: Form = {
  store_name: "",
  owner_name: "",
  email: "",
  phone: "",
  city: "",
  category: CATEGORIES[0],
  password: "",
  confirm: "",
};

export default function SellerRegisterPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (form.password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await sellerApi.register({
        store_name: form.store_name,
        owner_name: form.owner_name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        city: form.city,
        category: form.category,
      });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px] border border-bfl-line bg-white p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bfl-yellow">
            <svg className="h-6 w-6" fill="none" stroke="#000" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <h1 className="mt-4 text-[22px] font-bold text-black">Application received</h1>
          <p className="mt-2 text-[14px] leading-6 text-bfl-grey">
            Thanks, {form.owner_name.split(" ")[0]}. Our marketplace team reviews new stores within
            two business days. We&apos;ll email <span className="font-bold text-black">{form.email}</span>{" "}
            as soon as <span className="font-bold text-black">{form.store_name}</span> is approved —
            you can sign in and start adding products right away.
          </p>
          <Link href="/seller/login" className="btn-bfl mt-6 inline-block px-8 py-3 text-[14px]">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-bfl-yellow">
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8Z" />
            <path strokeLinecap="round" d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
          </svg>
        </span>
        <span className="font-heading text-lg font-bold text-bfl-ink">
          Kandi<span className="text-black"> For Less</span>
        </span>
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="border border-bfl-line bg-white p-7">
          <h1 className="text-[24px] font-bold text-black">Sell on Kandi</h1>
          <p className="mt-1 text-[13px] text-bfl-grey">
            Tell us about your store. Approval usually takes under two business days.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Store name" hint="Shown to shoppers on every listing.">
                <input
                  required
                  value={form.store_name}
                  onChange={(e) => set("store_name", e.target.value)}
                  placeholder="e.g. Nakasero Kids"
                  className={INPUT}
                />
              </Field>

              <Field label="Your full name">
                <input
                  required
                  value={form.owner_name}
                  onChange={(e) => set("owner_name", e.target.value)}
                  className={INPUT}
                />
              </Field>

              <Field label="Email address">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={INPUT}
                />
              </Field>

              <Field label="Phone number">
                <input
                  required
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="07XX XXX XXX"
                  className={INPUT}
                />
              </Field>

              <Field label="City / town">
                <input
                  required
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Kampala"
                  className={INPUT}
                />
              </Field>

              <Field label="Main category">
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className={INPUT}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </Field>

              <Field label="Password" hint="At least 8 characters.">
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  className={INPUT}
                />
              </Field>

              <Field label="Confirm password">
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(e) => set("confirm", e.target.value)}
                  className={INPUT}
                />
              </Field>
            </div>

            {error && (
              <p role="alert" className="border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[13px] text-[#a51f1f]">
                {error}
              </p>
            )}

            <p className="text-[12px] leading-5 text-bfl-grey">
              By continuing you agree to the Kandi seller terms, including the marketplace commission
              deducted from each completed order.
            </p>

            <button type="submit" disabled={submitting} className="btn-bfl w-full py-3.5 text-[14px]">
              {submitting ? "Submitting…" : "Create seller account"}
            </button>

            <p className="text-center text-[13px] text-bfl-grey">
              Already selling with us?{" "}
              <Link href="/seller/login" className="link-bfl font-bold">
                Sign in
              </Link>
            </p>
          </form>
        </div>

        {/* Why sell with us */}
        <aside className="h-fit border border-bfl-line bg-white p-6">
          <h2 className="text-[15px] font-bold text-black">Why sell with Kandi</h2>
          <ul className="mt-4 space-y-4 text-[13px] leading-5 text-bfl-grey">
            {[
              ["No listing fees", "You only pay commission on completed orders."],
              ["Nationwide delivery", "We handle logistics across Uganda."],
              ["Weekly payouts", "Settled to MTN MoMo, Airtel Money or your bank."],
              ["Live dashboard", "Track sales, stock and commission in real time."],
            ].map(([title, copy]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bfl-yellow">
                  <svg className="h-3 w-3" fill="none" stroke="#000" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                </span>
                <span>
                  <span className="block font-bold text-black">{title}</span>
                  {copy}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

const INPUT =
  "w-full border border-bfl-line px-3 py-2.5 text-[14px] focus:border-black focus:outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[#333]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-bfl-grey">{hint}</span>}
    </label>
  );
}
