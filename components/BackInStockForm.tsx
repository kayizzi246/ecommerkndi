"use client";

import { useState } from "react";

/**
 * The one thing worth asking for on a sold-out product page.
 *
 * ---- Why an email box and not just a link elsewhere ----
 *
 * The sold-out block already offers "browse more in {category}", which serves
 * the shopper who will take a substitute. It does nothing for the one who wants
 * THIS item — and that shopper is the more valuable of the two, because they
 * have already decided. Sending them to a category is asking them to start
 * again; a box asks for ten seconds and keeps the sale alive.
 *
 * ---- Why it stays quiet until it is used ----
 *
 * One line and one field, in the panel that is already explaining the bad news.
 * A sold-out page is a disappointment, and a boxed-out signup form on top of it
 * reads as the shop asking for something at the moment it has failed to deliver
 * something. The form earns its place by being smaller than the apology.
 *
 * On success the field is replaced outright rather than showing a message under
 * it: a form still standing after a submission invites a second one, and two
 * identical requests are two emails for the same shopper.
 */
export default function BackInStockForm({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;

    setState("sending");
    setError(null);

    try {
      const response = await fetch("/api/back-in-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, productId, productName }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(payload?.message ?? "That did not go through. Please try again.");
        setState("idle");
        return;
      }

      setState("done");
    } catch {
      // No connection, rather than a refusal from the server. Saying so is the
      // difference between a shopper retrying and a shopper concluding the shop
      // is broken.
      setError("Could not reach us. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p className="mt-3 flex items-start gap-2 border-t border-shop-line pt-3 text-[13px] leading-snug text-shop-success">
        <svg
          aria-hidden
          className="mt-[3px] h-3.5 w-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
        </svg>
        <span className="text-shop-body">
          <strong className="font-semibold text-shop-ink">We&apos;ll email you</strong> the
          moment this is back.
        </span>
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 border-t border-shop-line pt-3">
      <label
        htmlFor={`back-in-stock-${productId}`}
        className="text-[13px] font-semibold text-shop-ink"
      >
        Email me when it&apos;s back
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={`back-in-stock-${productId}`}
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field-shop min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="btn-shop shrink-0 px-5 text-[14px] disabled:opacity-60"
        >
          {state === "sending" ? "Saving…" : "Notify me"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-shop-error">{error}</p>}
    </form>
  );
}
