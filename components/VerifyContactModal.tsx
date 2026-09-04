"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatUgPhone } from "@/lib/phone";

/**
 * The one-time-code dialog.
 *
 * Two steps in one box: a destination, then the code that was sent to it. It is
 * one box on purpose — a shopper who is bounced to a second screen to type six
 * digits has lost sight of what they were buying, and the step they are on is
 * obvious from what is in front of them.
 *
 * ---- It does not close by itself ----
 *
 * No backdrop click, no Escape. That is unusual enough to be worth defending:
 * every other dialog in this shop closes when you click away from it, because
 * every other dialog is optional. This one is a gate in front of checkout, and
 * a gate that opens when you brush against it is a decoration. There are two
 * ways out and both are deliberate acts — the Cancel button and the × — and
 * both hand control back to the caller rather than merely hiding the box.
 *
 * What that costs is a shopper who feels trapped, and the answer to that is not
 * to make it dismissible but to make the exit obvious: the × is full-size and
 * in the corner where it is always looked for, and "Cancel" is spelled out
 * rather than being an icon.
 *
 * ---- Focus ----
 *
 * Focus moves into the dialog on open and is held there while it is up. A modal
 * that leaves focus on the page behind it is a modal a keyboard user can type
 * straight through, which for a gate means walking around it without meaning
 * to. The trap is small and hand-rolled rather than a dependency; the whole of
 * it is the `Tab` handler below.
 */

type Step = "destination" | "code";

export default function VerifyContactModal({
  open,
  title = "Verify your number",
  intro = "We send a 6-digit code so we know the rider can reach you. It only takes a moment, and we will not ask again.",
  smsOnly = false,
  initialValue = "",
  onVerified,
  onCancel,
}: {
  open: boolean;
  title?: string;
  intro?: string;
  /**
   * Hide the email alternative.
   *
   * For the two places where the PHONE specifically is what is being proved —
   * the seller sign-up, where somebody from the shop rings the number to
   * confirm the application. Offering email there would let a seller complete
   * the step without proving the thing the step is about, and the server would
   * then refuse the registration for a reason the form had just implied was
   * fine.
   *
   * Everywhere else the alternative stays, and not only as a kindness: an email
   * code costs the shop nothing where an SMS costs UGX 25–40.
   */
  smsOnly?: boolean;
  /** Pre-fills the destination — usually a number already typed into a form. */
  initialValue?: string;
  /** Called with the proved contact once the code checks out. */
  onVerified: (contact: { channel: "sms" | "email"; value: string }) => void;
  /** Cancel or ×. The caller decides what that means — usually "go back". */
  onCancel: () => void;
}) {
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [step, setStep] = useState<Step>("destination");
  const [to, setTo] = useState(initialValue);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const panel = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  /* ---- Resetting on open and close, without an effect ----

     Opening seeds the destination from the caller's form; closing clears the
     half-typed number, the stale challenge and the error left behind by a
     cancelled attempt — which is what otherwise produces "that code is not
     right" on a code that was correct for the number before it.

     Done by comparing against the previous render rather than in a
     `useEffect`, which is the arrangement React documents for state that
     derives from a prop change. An effect here would render the stale values
     once, then render again — a visible flash of the previous attempt every
     time the dialog opens — and `react-hooks/set-state-in-effect` rejects it
     for exactly that reason. Setting state during render of the SAME component
     is not a cascade: React discards the in-progress render and restarts it
     before anything is committed.

     `initialValue` is read here and is deliberately not watched. It changes on
     every keystroke in the caller's field, and reacting to that would rewrite
     the box under a shopper who is part-way through typing. */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      if (initialValue) setTo(initialValue);
    } else {
      setStep("destination");
      setCode("");
      setChallenge("");
      setError("");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open) firstField.current?.focus();
  }, [open, step]);

  /* The page behind a modal must not scroll — on a phone especially, where the
     dialog is short and the page under it is long, scrolling the background is
     indistinguishable from the dialog having gone away. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const trapFocus = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || !panel.current) return;

    const focusable = panel.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, to }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        challenge?: string;
        sentTo?: string;
        alreadyVerified?: boolean;
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "We could not send the code. Please try again.");
        return;
      }

      /* The server recognised this contact from a previous verification and
         sent nothing. Straight through — charging the shop for a second SMS to
         prove a fact it already holds would be the one thing this whole feature
         is meant to avoid. */
      if (data.alreadyVerified) {
        onVerified({ channel, value: to });
        return;
      }

      setChallenge(data.challenge ?? "");
      setSentTo(data.sentTo ?? "");
      setStep("code");
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, code }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        contact?: string;
        channel?: "sms" | "email";
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "That code is not right.");
        return;
      }

      onVerified({ channel: data.channel ?? channel, value: data.contact ?? to });
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      /* No `onClick` on the backdrop. See the note at the top — this is the
         whole difference between a gate and a suggestion. */
      role="presentation"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-title"
        onKeyDown={trapFocus}
        className="w-full max-w-[420px] rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="verify-title" className="text-[18px] font-extrabold text-shop-ink">
            {step === "destination" ? title : "Enter the code"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[22px] leading-none text-shop-muted transition-colors hover:bg-shop-surface hover:text-shop-ink"
          >
            ×
          </button>
        </div>

        {step === "destination" ? (
          <form onSubmit={send} className="mt-2">
            <p className="text-[13.5px] leading-relaxed text-shop-body">{intro}</p>

            {channel === "sms" ? (
              <>
                <label
                  htmlFor="verify-phone"
                  className="mt-4 block text-[13px] font-semibold text-shop-ink"
                >
                  Mobile number
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  {/* The country code is printed rather than typed. Every
                      number this shop can deliver to is +256, and a shopper who
                      types it themselves types it four different ways —
                      `normaliseUgPhone` accepts all of them, but showing the
                      prefix is what stops the question being asked. */}
                  <span className="shrink-0 rounded-lg bg-shop-surface px-3 py-2.5 text-[15px] font-semibold text-shop-body">
                    +256
                  </span>
                  <input
                    ref={firstField}
                    id="verify-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    placeholder="772 123 456"
                    className="field-shop flex-1 px-3 py-2.5 text-[15px]"
                  />
                </div>
              </>
            ) : (
              <>
                <label
                  htmlFor="verify-email"
                  className="mt-4 block text-[13px] font-semibold text-shop-ink"
                >
                  Email address
                </label>
                <input
                  ref={firstField}
                  id="verify-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="you@example.com"
                  className="field-shop mt-1.5 w-full px-3 py-2.5 text-[15px]"
                />
              </>
            )}

            {error && (
              <p role="alert" className="mt-2.5 text-[13px] font-medium text-shop-sale">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-shop mt-4 w-full py-3 text-[15px]">
              {busy ? "Sending…" : "Send code"}
            </button>

            {/* ---- "or use email" ----

                The alternative is offered rather than buried, and not only as a
                kindness: an email code costs the shop nothing where an SMS
                costs UGX 25–40, so every shopper who takes this route is a
                margin the shop keeps. It sits under the button because the
                phone is still the channel the shop WANTS — the number is what
                the rider calls. */}
            {!smsOnly && (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-shop-line" />
                  <span className="text-[12px] uppercase tracking-[0.08em] text-shop-muted">
                    or
                  </span>
                  <span className="h-px flex-1 bg-shop-line" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setChannel(channel === "sms" ? "email" : "sms");
                    setTo("");
                    setError("");
                  }}
                  className="mt-3 w-full text-[13.5px] font-semibold text-shop-primary-ink underline underline-offset-4 hover:text-shop-ink"
                >
                  {channel === "sms"
                    ? "Use my email address instead"
                    : "Use my phone number instead"}
                </button>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={verify} className="mt-2">
            <p className="text-[13.5px] leading-relaxed text-shop-body">
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-shop-ink">{sentTo}</span>. It expires in 10
              minutes.
            </p>

            <label htmlFor="verify-code" className="sr-only">
              6-digit code
            </label>
            <input
              ref={firstField}
              id="verify-code"
              name="one-time-code"
              type="text"
              inputMode="numeric"
              /* `one-time-code` is what lets iOS and Android offer the code
                 from the SMS notification as a keyboard suggestion. It is one
                 attribute and it removes the entire copy-paste step, which is
                 where this flow otherwise loses people. */
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className="field-shop mt-3 w-full px-3 py-3 text-center text-[24px] font-bold tracking-[0.4em]"
            />

            {error && (
              <p role="alert" className="mt-2.5 text-[13px] font-medium text-shop-sale">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="btn-shop mt-4 w-full py-3 text-[15px] disabled:opacity-60"
            >
              {busy ? "Checking…" : "Verify and continue"}
            </button>

            <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
              <button
                type="button"
                onClick={() => {
                  setStep("destination");
                  setCode("");
                  setError("");
                }}
                className="font-semibold text-shop-body underline underline-offset-4 hover:text-shop-ink"
              >
                {channel === "sms"
                  ? `Change number${to ? ` (${formatUgPhone(to)})` : ""}`
                  : "Change address"}
              </button>
              <button
                type="button"
                onClick={() => send()}
                disabled={busy}
                className="font-semibold text-shop-primary-ink underline underline-offset-4 hover:text-shop-ink"
              >
                Resend
              </button>
            </div>
          </form>
        )}

        {/* Cancel, spelled out. The × in the corner does the same thing; both
            are here because they are looked for in different places, and a gate
            with a hidden exit is the kind of thing shoppers abandon a basket
            over. */}
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full rounded-lg py-2 text-[13.5px] font-semibold text-shop-muted transition-colors hover:bg-shop-surface hover:text-shop-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
