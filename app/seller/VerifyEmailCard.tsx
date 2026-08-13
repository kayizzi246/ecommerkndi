"use client";

import { useEffect, useRef, useState } from "react";
import { sellerApi } from "@/lib/seller";

/**
 * The six-digit code screen, shared by sign-up and sign-in.
 *
 * One component in both places on purpose: a seller who abandons registration
 * before entering the code and comes back through the login form has to meet
 * the same screen, or the account is unreachable and they open a second one.
 *
 * Entering the code signs them in — the endpoint returns a session — so this is
 * the last thing between registering and the dashboard.
 */
export default function VerifyEmailCard({
  email,
  onVerified,
  onCancel,
  cancelLabel = "Use a different account",
}: {
  email: string;
  onVerified: () => void | Promise<void>;
  /** The way out, when there is somewhere to go back to. */
  onCancel?: () => void;
  /**
   * What that way out is called.
   *
   * On the sign-in screen it means "this is not my account". After registering
   * it means "I will do this later" — the seller is already signed in by then,
   * and calling it "use a different account" would offer to undo a store they
   * have just spent five minutes creating.
   */
  cancelLabel?: string;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Seconds until "send another" becomes available again. */
  const [cooldown, setCooldown] = useState(30);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      await sellerApi.verify(email, value);
      await onVerified();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code did not work.");
      setCode("");
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      const { message } = await sellerApi.resendCode(email);
      setNotice(message);
      setCooldown(30);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send another code.");
    }
  };

  return (
    <div className="border border-bfl-line bg-white p-7">
      <h1 className="text-[24px] font-extrabold text-black">Check your email</h1>
      <p className="mt-1.5 text-[14px] text-bfl-grey">
        We sent a six-digit code to <strong className="text-black">{email}</strong>. Enter it
        below to confirm the address is yours.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length === 6) verify(code);
        }}
        className="mt-6"
      >
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-[#333]">
            Verification code
          </span>
          <input
            ref={inputRef}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            disabled={busy}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(digits);
              setError(null);
              // Submitting itself once six digits are in: nobody wants to type
              // a code and then hunt for a button.
              if (digits.length === 6) verify(digits);
            }}
            placeholder="000000"
            className="w-full border border-bfl-line px-3 py-3 text-center text-[26px] font-bold tracking-[10px] focus:border-black focus:outline-none disabled:opacity-60"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="mt-3 border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[14px] text-[#a51f1f]"
          >
            {error}
          </p>
        )}

        {notice && !error && (
          <p className="mt-3 border-l-2 border-pop-green bg-pop-green-soft px-3 py-2 text-[14px] text-pop-green">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="btn-bfl mt-4 w-full py-3 text-[15px] disabled:opacity-60"
        >
          {busy ? "Checking…" : "Verify and continue"}
        </button>
      </form>

      <div className="mt-5 border-t border-bfl-line pt-4 text-center text-[14px] text-bfl-grey">
        <p>
          No email yet? Check your spam folder, then{" "}
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0}
            className="link-bfl font-semibold disabled:text-bfl-grey disabled:no-underline"
          >
            {cooldown > 0 ? `send another in ${cooldown}s` : "send another"}
          </button>
          .
        </p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="mt-2 link-bfl">
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  );
}
