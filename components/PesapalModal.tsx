"use client";

import { useEffect, useRef, useState } from "react";

export type PesapalOutcome = {
  paid: boolean;
  cancelled: boolean;
  message: string;
  orderId?: number | null;
};

/**
 * The payment window: Pesapal's own checkout, loaded in an iframe over the shop.
 *
 * An iframe rather than a redirect so the shopper never leaves KandiUg — the
 * cart, the page they were on and the browser history all survive a payment
 * that fails or is abandoned.
 *
 * Pesapal's callback page posts the outcome back from inside the frame; this
 * listens for it. The listener checks `event.origin` against our own, because a
 * message handler that trusts any sender is a way for another site to tell this
 * page a payment succeeded.
 */
export default function PesapalModal({
  url,
  title = "Complete your payment",
  onDone,
  onClose,
}: {
  /** Pesapal's redirect_url. Null keeps the modal closed. */
  url: string | null;
  title?: string;
  onDone: (outcome: PesapalOutcome) => void;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  /**
   * What the window is showing.
   *
   *   paying     — Pesapal's own checkout, in the iframe.
   *   confirming — our spinner, covering it.
   *   done       — the tick, then the caller takes over.
   *
   * ---- Why this exists ----
   *
   * The last thing a shopper saw on a successful payment was PESAPAL'S receipt:
   * a panel listing the merchant, a tracking id, a merchant ref and the masked
   * account it came from. That is a payment processor's paperwork, and it is the
   * wrong thing to end a purchase on — it is addressed to the shop, not the
   * buyer, and it says nothing about the order they just placed. The shop then
   * vanished the whole window and jumped to another page, so the moment of
   * "it worked" belonged to Pesapal rather than to KandiUg.
   *
   * Now the instant payment is confirmed the frame is covered by our own screen:
   * a spinner while the order is settled, then a tick, then the caller navigates.
   *
   * ---- The honest limit ----
   *
   * Pesapal's receipt is a cross-origin page. It cannot be hidden or restyled
   * from here, and it appears in the seconds between the payment succeeding and
   * Pesapal redirecting the frame to our callback. What this removes is the
   * receipt *lingering* — from the callback firing onwards the shopper sees only
   * KandiUg. Removing it entirely would mean polling our own server for the
   * order's payment state and covering the frame the moment it flips, which
   * needs an endpoint the shop does not have yet.
   */
  const [phase, setPhase] = useState<"paying" | "confirming" | "done">("paying");

  // The handler is kept in a ref so the listener below does not need it as a
  // dependency — otherwise every parent re-render would tear the listener down
  // and rebuild it, and a message arriving in that gap would be lost. Written
  // in an effect rather than during render, which is the rule refs exist under.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  /** The confirmation beats, held so they can be cancelled on unmount. */
  const confirmTimers = useRef<number[]>([]);

  useEffect(() => {
    if (!url) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as (PesapalOutcome & { source?: string }) | null;
      if (!data || data.source !== "kandi-pesapal") return;

      const outcome: PesapalOutcome = {
        paid: Boolean(data.paid),
        cancelled: Boolean(data.cancelled),
        message: String(data.message ?? ""),
        orderId: data.orderId ?? null,
      };

      /* A failure or a cancellation goes back to the caller immediately — there
         is nothing to celebrate and the shopper needs the error, not a spinner
         that resolves into bad news. */
      if (!outcome.paid) {
        onDoneRef.current(outcome);
        return;
      }

      // Cover Pesapal's receipt straight away, then run the beats.
      setPhase("confirming");

      confirmTimers.current.push(
        window.setTimeout(() => setPhase("done"), 900),
        // Long enough for the tick to register as a moment rather than a
        // flicker, short enough that nobody waits for it. The caller navigates
        // from here, so this is the last thing seen of the payment window.
        window.setTimeout(() => onDoneRef.current(outcome), 2000)
      );
    };

    window.addEventListener("message", onMessage);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("message", onMessage);
      document.body.style.overflow = "";
      // Cleared on unmount, so a modal closed mid-confirmation cannot fire
      // `onDone` at a checkout that has already moved on.
      confirmTimers.current.forEach(window.clearTimeout);
      confirmTimers.current = [];
    };
  }, [url]);

  if (!url) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-xl bg-white">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-shop-line px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-shop-ink">{title}</p>
            <p className="text-[12px] text-shop-muted">Secured by Pesapal</p>
          </div>
          {/* Closing is always allowed WHILE PAYING. If the money has already
              left, the IPN settles the order regardless of what this window
              does — so abandoning costs the shopper nothing.

              It disappears once payment is confirmed. At that point there is
              nothing left to abandon, the screen is two seconds from moving on
              by itself, and a close button beside a success tick invites the
              one click that would drop the shopper back onto a checkout for an
              order they have already paid for. */}
          {phase === "paying" && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close payment window"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[22px] leading-none text-shop-muted hover:bg-shop-hairline hover:text-shop-ink"
            >
              ×
            </button>
          )}
        </header>

        <div className="relative min-h-0 flex-1">
          {!loaded && (
            <p className="absolute inset-0 flex items-center justify-center text-[14px] text-shop-muted">
              Loading payment options…
            </p>
          )}
          <iframe
            src={url}
            title={title}
            onLoad={() => setLoaded(true)}
            // `allow-forms` and `allow-scripts` are what a payment page needs;
            // `allow-same-origin` lets our callback page inside the frame reach
            // `window.parent.postMessage`. `allow-top-navigation` is withheld,
            // so nothing in the frame can navigate the shop away underneath it.
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
            className="h-full w-full border-0"
          />

          {/* ---- The confirmation ----
               Opaque and covering the whole frame, which is the point: Pesapal's
               receipt is still sitting underneath it and must not show through.
               `inset-0` on the same relative parent as the iframe, so it cannot
               be scrolled past or peeked around. */}
          {phase !== "paying" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-white px-8 text-center">
              {phase === "confirming" ? (
                <>
                  {/* A ring, not a bar: the wait is a few hundred milliseconds
                      and has no measurable progress, so anything that implies a
                      percentage would be inventing one. */}
                  <span
                    aria-hidden
                    className="h-12 w-12 animate-spin rounded-full border-[3px] border-shop-line border-t-shop-primary motion-reduce:animate-none"
                  />
                  <div>
                    <p className="text-[17px] font-semibold text-shop-ink">
                      Payment received
                    </p>
                    <p className="mt-1 text-[14px] text-shop-body">
                      Completing your order…
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* The tick is drawn rather than popped — the same
                      `check-ring` / `check-draw` pair the seller onboarding
                      ends on, so the two moments of success in this shop look
                      like they belong to one product. Both are switched off
                      under prefers-reduced-motion in globals.css. */}
                  <span className="check-ring flex h-16 w-16 items-center justify-center rounded-full bg-shop-successbg">
                    <svg
                      aria-hidden
                      className="h-8 w-8 text-shop-success"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path className="check-draw" d="m5 13 4 4L19 7" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[18px] font-bold text-shop-ink">Order complete</p>
                    <p className="mt-1 text-[14px] text-shop-body">
                      Thank you — we are getting it ready.
                    </p>
                  </div>
                </>
              )}

              {/* Announced once, politely, for anyone not looking at the screen. */}
              <span aria-live="polite" className="sr-only">
                {phase === "confirming" ? "Payment received, completing your order" : "Order complete"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
