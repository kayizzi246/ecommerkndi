"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { sellerApi, type Seller } from "@/lib/seller";
import { formatPrice } from "@/lib/currency";
import VerifyEmailCard from "@/app/seller/VerifyEmailCard";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import SellerAuthLayout from "@/components/seller/SellerAuthLayout";
import { takeGoogleCredential } from "@/lib/seller-google-handoff";
import { useSellerSession } from "@/lib/seller-session";
import VerifyContactModal from "@/components/VerifyContactModal";
import { formatUgPhone, normaliseUgPhone } from "@/lib/phone";

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
};

/**
 * Four-step seller sign-up, then a confirmation.
 *
 * Each step validates before it will advance, so a mistake is caught on the
 * screen that caused it rather than at the end. The account is only created
 * when the last step is submitted — abandoning halfway leaves nothing behind.
 *
 * Signing up does not open the Seller Centre. It creates the account and sends
 * the emailed code; the verification documents and the first month's fee are then
 * collected by the setup gate at /seller/onboarding, which the dashboard cannot
 * be reached past. Everything to do with paying lives there, in one place.
 */
export default function OnboardingFlow({ registrationFee, commissionRate }: Props) {
  const feeApplies = registrationFee > 0;
  const { refresh: refreshSession } = useSellerSession();

  /**
   * Opening this screen ends whatever session the browser was carrying.
   *
   * Somebody on "Open a seller account" is, by definition, not signed in — and
   * the seller cookie lasts a fortnight. Without this, every stale session in
   * every browser that ever signed a seller in stayed live underneath the form:
   * abandon the sign-up, or have it rejected, then click anything into /seller,
   * and the old store opens as though it were yours. That is what kept putting
   * one test account in front of people registering with their own address.
   *
   * `endSession` forgets the cookie here without destroying the token on
   * WordPress, so a seller who really is signed in elsewhere is not kicked out
   * of their own dashboard by someone opening this page — see the route.
   *
   * Failure is ignored on purpose: the fallback is the session that was already
   * there, and blocking sign-up behind a housekeeping call that did not answer
   * would be a worse outcome than the one being prevented.
   */
  useEffect(() => {
    sellerApi
      .endSession()
      .then(() => refreshSession())
      .catch(() => undefined);
  }, [refreshSession]);

  /**
   * How the seller is signing up, chosen before anything else is asked.
   *
   * Google comes first because it is the shorter road and the one that makes
   * *coming back* trivial — a seller who signs up with a password has to
   * remember it in a month; one who used Google taps the same button. It also
   * removes two whole steps: the address is already proven, so there is no code
   * to wait for, and there is no password to choose or confirm.
   */
  const [method, setMethod] = useState<"google" | "password" | null>(null);
  /** The raw Google token, held until submit and re-verified server-side then. */
  const [credential, setCredential] = useState<string | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(false);

  const viaGoogle = method === "google";

  const STEPS = [
    { key: "store", title: "Your store", blurb: "What shoppers will see" },
    { key: "you", title: "About you", blurb: "So we can reach you" },
    // Nothing to secure on a Google account: there is no password, and the
    // address is already proven.
    ...(viaGoogle ? [] : [{ key: "password", title: "Security", blurb: "Protect your account" }]),
    ...(feeApplies
      ? [{ key: "fee", title: "Joining fee", blurb: "One-off, and what it pays for" }]
      : []),
  ];

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* The number this browser has proved, in +2567XXXXXXXX form. Compared against
     the field rather than replacing it, so a seller who verifies one number and
     then edits the box is asked again — the case a single "verified" boolean
     would silently get wrong. */
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  const phoneVerified =
    verifiedPhone !== null && normaliseUgPhone(form.phone) === verifiedPhone;

  useEffect(() => {
    /* A seller who verified at a checkout on this browser has already proved a
       number; if it is the one they are typing, this step is already done. */
    let live = true;
    fetch("/api/otp/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { verified?: boolean; channel?: string; contact?: string } | null) => {
        if (live && data?.verified && data.channel === "sms" && data.contact) {
          setVerifiedPhone(data.contact);
        }
      })
      .catch(() => {
        /* Left unproved. The button below is the way through, and the server
           refuses the registration regardless. */
      });
    return () => {
      live = false;
    };
  }, []);
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
      // A Google address comes from the token, not from this form, so there is
      // nothing here to validate — and nothing the seller could have mistyped.
      if (!viaGoogle && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
        return "Enter a valid email address.";
      }
      if (!normaliseUgPhone(form.phone)) {
        return "Enter a Ugandan mobile number we can call, like 0772 123 456.";
      }
      /* The step cannot be left unproved. Checked here rather than only at
         submit so the seller meets it beside the field it is about, three
         screens before the store is created — being told at the end that a
         number typed at the start needs verifying is how a sign-up is
         abandoned. */
      if (!phoneVerified) return "Verify your phone number to continue.";
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
        phone: form.phone.trim(),
        city: form.city,
        category: form.category,
        // Exactly one of these. With Google the address is taken from the token
        // server-side and whatever is in the form is ignored.
        ...(viaGoogle && credential
          ? { google_credential: credential }
          : { email: form.email.trim(), password: form.password }),
      });
      setCreated(seller);

      /**
       * Registering now signs the seller in, so this browser *is* the new
       * store from here on. Refreshing the session is what makes the rest of
       * the Seller Centre agree with that — without it the shell keeps whoever
       * it resolved on mount, which for anyone registering on a machine that
       * had a seller signed in was that other seller's store.
       */
      await refreshSession();

      /**
       * No longer a wall.
       *
       * The code screen used to be compulsory here, because registration
       * returned no session and the code was the only way to get one. When the
       * emailed code did not arrive — a host without SMTP sends nothing — the
       * store that had just been created was unreachable, permanently, by
       * anybody. That is what left this site with one usable seller account.
       *
       * The address is still worth confirming, so an unconfirmed seller is
       * offered the code box right away. Skipping it now costs them only
       * payouts, and the dashboard says so on every screen until it is done.
       */
      setVerifying(!seller.email_verified);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Reads the Google account, fills in what it tells us, and moves on.
   *
   * The account is *not* created here — the store has no name yet. The token is
   * kept and sent with the finished form, where the server verifies it again.
   */
  // Stable across renders: the Google button re-initialises whenever its
  // handler changes, and this screen re-renders on every keystroke of error
  // state. An inline arrow here would make the button flicker.
  const continueWithGoogle = useCallback(async (googleCredential: string) => {
    setCheckingGoogle(true);
    setError(null);
    try {
      const response = await fetch("/api/seller/google/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: googleCredential }),
      });
      const identity = (await response.json().catch(() => ({}))) as {
        email?: string;
        name?: string;
        message?: string;
      };

      if (!response.ok || !identity.email) {
        setError(identity.message ?? "Google sign-in failed. Try again, or use your email.");
        return;
      }

      setCredential(googleCredential);
      setForm((current) => ({
        ...current,
        email: identity.email ?? "",
        owner_name: current.owner_name || identity.name || "",
      }));
      setMethod("google");
      setStep(0);
    } catch {
      setError("Could not reach Google. Check your connection and try again.");
    } finally {
      setCheckingGoogle(false);
    }
  }, []);

  /**
   * Picks up a seller sent here from the sign-in screen.
   *
   * They pressed "Continue with Google" over there, and it turned out no store
   * uses that address — so they arrive already authenticated with Google and
   * should not have to press the same button a second time. The token is read
   * once and destroyed by `takeGoogleCredential`.
   */
  useEffect(() => {
    const handed = takeGoogleCredential();
    // State does change as a result — that is the point of the handoff, and it
    // happens once on mount from a value that only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (handed) continueWithGoogle(handed);
  }, [continueWithGoogle]);

  // ---- The first screen: how are you signing up? ----
  if (!method) {
    return (
      // ---- Left-aligned, and the card is gone ----
      //
      // Everything here used to be centred inside a bordered box. Centred body
      // copy gives every line a different starting edge, so the eye re-finds
      // the left margin on each one — fine for three words, not for a
      // paragraph — and the box was a border drawn around the only thing on a
      // white page, which is a frame around a frame.
      //
      // The panel beside it is the surface now, so this side can be plain.
      <SellerAuthLayout eyebrow="Sell on Kandi">
        <h1 className="mt-2 text-[30px] font-extrabold leading-[1.15] tracking-tight text-shop-ink">
          Open your store
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-shop-body">
          Takes about three minutes. We will ask for your store name, what you
          sell and a number we can call.
        </p>

        <div className="mt-8">
          {/* Google is full-width here rather than a centred island, so it
              stacks flush with the email button below and the two read as one
              pair of choices rather than two unrelated controls. */}
          <div className="flex justify-center [&>div]:w-full">
            <GoogleSignInButton
              onCredential={continueWithGoogle}
              onError={(message) => setError(message)}
              text="signup_with"
            />
          </div>
          <p className="mt-2.5 text-[13px] text-shop-muted">
            {checkingGoogle
              ? "Checking your Google account…"
              : "Fastest — and signing back in later is one tap."}
          </p>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.1em] text-shop-muted">
            <span className="h-px flex-1 bg-shop-line" />
            or
            <span className="h-px flex-1 bg-shop-line" />
          </div>

          <button
            type="button"
            onClick={() => {
              setMethod("password");
              setError(null);
            }}
            className="btn-shop-outline w-full py-3 text-[15px]"
          >
            Sign up with an email address
          </button>
          <p className="mt-2.5 text-[13px] text-shop-muted">
            We will email you a six-digit code to confirm the address.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red"
            >
              {error}
            </p>
          )}
        </div>

        <p className="mt-8 border-t border-shop-line pt-6 text-[14px] text-shop-muted">
          Already selling?{" "}
          <Link href="/seller/login" className="font-semibold text-shop-primary hover:underline">
            Sign in
          </Link>
        </p>
      </SellerAuthLayout>
    );
  }

  if (created && verifying) {
    return (
      // The code box inherits the same frame, so confirming an address does not
      // drop the seller onto a bare white page halfway through signing up.
      <SellerAuthLayout eyebrow="Sell on Kandi">
        <div className="mt-2">
          <VerifyEmailCard
            email={form.email.trim()}
            /**
             * Verifying is the moment this browser stops being whoever it was
             * and becomes this seller: the code exchange sets a fresh session
             * cookie server-side. Without refreshing here, the session context
             * keeps whatever it resolved on mount — which, for anybody
             * registering on a machine that had another seller signed in, was
             * that other seller. They would finish sign-up and be shown someone
             * else's store.
             *
             * `refresh` re-reads the new cookie, and `me()` repoints this
             * screen's own copy, so the confirmation names the store just
             * created rather than the one that was there before.
             */
            onVerified={async () => {
              await refreshSession();
              const { seller: current } = await sellerApi
                .me()
                .catch(() => ({ seller: null }));
              if (current) setCreated(current);
              setVerifying(false);
            }}
            onCancel={() => setVerifying(false)}
            cancelLabel="I'll do this later"
          />
          <p className="mt-4 text-center text-[13px] text-shop-muted">
            Your store is saved and you are signed in — this only confirms we can reach you.
          </p>
        </div>
      </SellerAuthLayout>
    );
  }

  if (created) {
    return (
      <Done seller={created} registrationFee={registrationFee} />
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
            <h1 className="mt-2 text-[21px] font-extrabold leading-tight text-shop-ink md:text-[24px]">
              {STEPS[step].key === "store" && "Let's name your store"}
              {STEPS[step].key === "you" && "Now, a bit about you"}
              {STEPS[step].key === "password" && "Secure your account"}
              {STEPS[step].key === "fee" && "One last thing: your first month"}
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
                        kandiug.com/{slugify(form.store_name)}
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

                  {viaGoogle ? (
                    // Not an input: this address came from the Google token and
                    // the server takes it from there too, so a field here would
                    // be an edit box over a value nothing reads.
                    <Field
                      delay={1}
                      label="Email"
                      hint="Confirmed by Google — order alerts and payout confirmations go here."
                    >
                      <div className="flex items-center gap-2 rounded-xl border border-shop-line bg-shop-hairline px-4 py-3">
                        <svg
                          aria-hidden
                          className="h-4 w-4 shrink-0 text-pop-green"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                        </svg>
                        <span className="min-w-0 truncate text-[16px] text-shop-ink">
                          {form.email}
                        </span>
                      </div>
                    </Field>
                  ) : (
                    <Field delay={1} label="Email" hint="Where order alerts and payout confirmations go.">
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => set("email", event.target.value)}
                        autoComplete="email"
                        className="field-shop text-[16px]"
                      />
                    </Field>
                  )}

                  <Field delay={2} label="Phone" hint="We call this number to confirm your application.">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => set("phone", event.target.value)}
                      placeholder="07XX XXX XXX"
                      autoComplete="tel"
                      className="field-shop text-[16px]"
                    />

                    {/* ---- Proved, not just typed ----

                        The hint above this field says what the number is for:
                        somebody at the shop rings it to confirm the
                        application. A mistyped number is two failed calls and a
                        rejected store, for a reason that was a slipped finger.

                        The row re-arms itself when the field is edited, because
                        `phoneVerified` compares the proved number with what is
                        in the box rather than holding a boolean. Verify 0772…,
                        change the last digit, and this goes back to asking. */}
                    {phoneVerified ? (
                      <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-shop-ink">
                        <span aria-hidden className="text-shop-success">
                          ✓
                        </span>
                        {formatUgPhone(form.phone)} verified
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVerifyingPhone(true)}
                        disabled={!normaliseUgPhone(form.phone)}
                        className="btn-shop-outline mt-2 w-full py-2 text-[13px] disabled:opacity-50"
                      >
                        Send me a code
                      </button>
                    )}
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

      {/* Cancelling leaves the seller on the "you" step with the row still
          asking, rather than sending them anywhere. Unlike the checkout gate
          there is nothing unusable behind this dialog — they can go back a
          step, change the number, or leave. `validate()` is what actually holds
          the step, and the server refuses the registration regardless. */}
      <VerifyContactModal
        open={verifyingPhone}
        title="Verify your phone number"
        intro="We send a 6-digit code to the number we will call to confirm your application."
        /* No email alternative here: the phone is the whole point of the step.
           And seeded from the field, so the seller does not type it twice. */
        smsOnly
        initialValue={form.phone}
        onVerified={(contact) => {
          if (contact.channel === "sms") setVerifiedPhone(contact.value);
          setVerifyingPhone(false);
          setError(null);
        }}
        onCancel={() => setVerifyingPhone(false)}
      />
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

/** The monthly fee, explained before anyone is asked to pay it. */
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
 * The first month's fee, paid on the spot through Pesapal.
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
/** Confirmation, with the payment instructions the seller needs next. */
function Done({
  seller,
  registrationFee,
}: {
  seller: Seller;
  registrationFee: number;
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
          {feeDue
            ? "Two things left: your verification documents and your first month's fee. Both take a couple of minutes."
            : "Send us your verification documents and your store goes to our team for approval."}
        </p>

        {/* No payment panel here any more. Paying lives in one place — the setup
            gate — so a seller cannot half-finish in two different screens and be
            unsure which one counted. Verifying signed them in, so this link
            lands them straight on it. */}
        <Link href="/seller/onboarding" className="btn-shop mt-7 w-full py-3.5 text-[16px]">
          Finish setting up
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

