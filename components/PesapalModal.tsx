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

  // The handler is kept in a ref so the listener below does not need it as a
  // dependency — otherwise every parent re-render would tear the listener down
  // and rebuild it, and a message arriving in that gap would be lost. Written
  // in an effect rather than during render, which is the rule refs exist under.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!url) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as (PesapalOutcome & { source?: string }) | null;
      if (!data || data.source !== "kandi-pesapal") return;

      onDoneRef.current({
        paid: Boolean(data.paid),
        cancelled: Boolean(data.cancelled),
        message: String(data.message ?? ""),
        orderId: data.orderId ?? null,
      });
    };

    window.addEventListener("message", onMessage);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("message", onMessage);
      document.body.style.overflow = "";
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
          {/* Closing is always allowed. If the money has already left, the IPN
              settles the order regardless of what this window does. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment window"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[22px] leading-none text-shop-muted hover:bg-shop-hairline hover:text-shop-ink"
          >
            ×
          </button>
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
        </div>
      </div>
    </div>
  );
}
