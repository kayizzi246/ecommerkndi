"use client";

import { useEffect, useState } from "react";
import VerifyContactModal from "@/components/VerifyContactModal";
import { formatUgPhone } from "@/lib/phone";
import GoogleSignInButton from "@/components/GoogleSignInButton";

type Mode = "signin" | "register" | "forgot";

/**
 * Every way into a Kandi shopper account, in one panel.
 *
 * Google alone was turning people away. It only serves shoppers who have a
 * Google account *and* are willing to attach it to a shop, and a good share of
 * this market signs up with a Yahoo or a work address. Losing them happens at
 * the worst possible moment — they had already decided to buy.
 *
 * Email sits first and Google second, deliberately. The panel opens on the
 * form most people can use, and the one-tap option is right there for those it
 * suits; leading with Google would put the narrower door in front.
 *
 * Written once and reused everywhere sign-in is asked for, so a shopper meets
 * the same panel from the account page, a review box or the checkout, and so
 * that adding a way in later means editing one file rather than six.
 */
export default function SignInPanel({
  onSuccess,
  heading,
}: {
  /** Called once a session exists. Usually the session context's `refresh`. */
  onSuccess: () => void | Promise<void>;
  /** Optional line above the form, when the surrounding page has not said it. */
  heading?: string;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* The proved contact for this browser, or null. Read from the server rather
     than kept in state alone, because a shopper who verified at a checkout last
     month should meet a tick here rather than a second code. */
  const [verified, setVerified] = useState<{ channel: "sms" | "email"; value: string } | null>(
    null
  );
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    /* Only asked for on the sign-up tab. On the sign-in tab the answer changes
       nothing that is rendered, and a status call on every panel open is a
       request per masthead click. */
    if (mode !== "register" || verified) return;

    let live = true;
    fetch("/api/otp/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { verified?: boolean; channel?: "sms" | "email"; contact?: string } | null) => {
        if (live && data?.verified && data.channel && data.contact) {
          setVerified({ channel: data.channel, value: data.contact });
        }
      })
      .catch(() => {
        /* Left unverified. The dialog is one tap away and the server refuses
           the registration anyway, so a failed status call costs a shopper one
           extra tap rather than letting an unverified account through. */
      });

    return () => {
      live = false;
    };
  }, [mode, verified]);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    /* Open the dialog instead of posting a registration the server will
       refuse. The 403 path below still exists for the case this cannot cover —
       a cookie that expired between the status call and the submit. */
    if (mode === "register" && !verified) {
      setVerifying(true);
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    const endpoint =
      mode === "signin"
        ? "/api/auth/login"
        : mode === "register"
          ? "/api/auth/register"
          : "/api/auth/forgot";

    const body =
      mode === "register"
        ? { name, email, password }
        : mode === "signin"
          ? { email, password }
          : { email };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (data?.code === "verification_required") {
          setVerified(null);
          setVerifying(true);
          return;
        }
        setError(data?.message ?? "Something went wrong. Please try again.");
        return;
      }

      // "Forgot" never signs anybody in — it only promises an email, and says
      // so whether or not the address is registered.
      if (mode === "forgot") {
        setNotice(data?.message ?? "If that address has an account, a reset link is on its way.");
        return;
      }

      await onSuccess();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-shop-line bg-white px-3.5 py-2.5 text-[15px] text-shop-ink outline-none transition-colors placeholder:text-shop-faint focus:border-shop-primary";

  return (
    <div className="text-left">
      {heading && (
        <h2 className="mb-4 text-center text-[18px] font-bold text-shop-ink">{heading}</h2>
      )}

      {/* Sign in / Create account. Hidden while resetting, where neither label
          describes what the shopper is doing. */}
      {mode !== "forgot" && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-shop-hairline p-1">
          {(["signin", "register"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchTo(value)}
              aria-pressed={mode === value}
              className={`rounded-lg py-2 text-[14px] font-semibold transition-colors ${
                mode === value
                  ? "bg-white text-shop-ink ring-1 ring-shop-line"
                  : "text-shop-muted hover:text-shop-ink"
              }`}
            >
              {value === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      {mode === "forgot" && (
        <p className="mb-4 text-[14px] leading-relaxed text-shop-muted">
          Enter the email address on your account and we will send you a link to choose a new
          password.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "register" && (
          <div>
            <label htmlFor="kandi-name" className="mb-1.5 block text-[13.5px] font-semibold text-shop-body">
              Your name
            </label>
            <input
              id="kandi-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className={field}
              placeholder="e.g. Sarah N."
            />
          </div>
        )}

        <div>
          <label htmlFor="kandi-email" className="mb-1.5 block text-[13.5px] font-semibold text-shop-body">
            Email address
          </label>
          <input
            id="kandi-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            /* `inputMode` matters more than it looks on a phone: it puts the
               "@" on the first keyboard instead of two taps away. */
            inputMode="email"
            className={field}
            placeholder="you@example.com"
          />
        </div>

        {/* ---- Prove a contact before the account exists ----

            The same dialog and the same sealed cookie the checkout gate uses,
            asked for here instead so a new account arrives with a number
            somebody holds. `/api/auth/register` refuses without it and reads
            the number out of the cookie rather than out of this form — see the
            note there for why the field is not the source of truth.

            Shown as a row rather than a step, because it is one tap for a
            shopper who verified at a previous checkout: `status` finds the
            cookie and this renders as already done. */}
        {mode === "register" && (
          <div className="rounded-xl border border-shop-line bg-shop-surface px-3.5 py-3">
            {verified ? (
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-shop-ink">
                <span aria-hidden className="text-shop-success">
                  ✓
                </span>
                {verified.channel === "sms" ? formatUgPhone(verified.value) : verified.value} verified
              </p>
            ) : (
              <>
                <p className="text-[13.5px] font-semibold text-shop-ink">
                  Verify your phone number
                </p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-shop-muted">
                  We send a 6-digit code. You can use your email instead.
                </p>
                <button
                  type="button"
                  onClick={() => setVerifying(true)}
                  className="btn-shop-outline mt-2.5 w-full py-2 text-[13.5px]"
                >
                  Verify now
                </button>
              </>
            )}
          </div>
        )}

        {mode !== "forgot" && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="kandi-password" className="block text-[13.5px] font-semibold text-shop-body">
                Password
              </label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => switchTo("forgot")}
                  className="text-[13px] font-semibold text-shop-primary hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="kandi-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                /* Telling the browser which of the two this is decides whether
                   a password manager offers to fill or to save. Getting it
                   wrong is why so many sign-up forms silently fail to save. */
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                minLength={mode === "register" ? 8 : undefined}
                className={`${field} pr-16`}
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 px-3 text-[13px] font-semibold text-shop-muted hover:text-shop-ink"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-shop-sale/10 px-3.5 py-2.5 text-[14px] text-shop-sale">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="rounded-xl bg-shop-primary-soft px-3.5 py-2.5 text-[14px] text-shop-ink">
            {notice}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-shop mt-1 w-full py-2.5 text-[15px]">
          {busy
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : mode === "register"
                ? "Create my account"
                : "Email me a reset link"}
        </button>
      </form>

      {mode === "forgot" ? (
        <button
          type="button"
          onClick={() => switchTo("signin")}
          className="mt-4 w-full text-center text-[14px] font-semibold text-shop-primary hover:underline"
        >
          Back to sign in
        </button>
      ) : (
        <>
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-shop-line" />
            <span className="text-[12.5px] font-semibold uppercase tracking-wide text-shop-faint">
              or
            </span>
            <span className="h-px flex-1 bg-shop-line" />
          </div>

          <div className="flex justify-center">
            <GoogleSignInButton
              endpoint="/api/auth/google"
              onSuccess={onSuccess}
              onError={setError}
            />
          </div>
        </>
      )}

      {/* Cancelling leaves the shopper on the sign-up form with the verify row
          still asking. That is the right outcome here and it is why this modal
          is not given a route to send them back to: unlike the checkout gate,
          nothing behind this dialog is unusable — they can switch to Sign in,
          use Google, or close the panel. */}
      <VerifyContactModal
        open={verifying}
        title="Verify your number"
        intro="We send a 6-digit code so we know the number on your account is one you hold. You can use your email address instead."
        onVerified={(contact) => {
          setVerified(contact);
          setVerifying(false);
        }}
        onCancel={() => setVerifying(false)}
      />
    </div>
  );
}
