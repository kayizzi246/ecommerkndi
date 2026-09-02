"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/currency";

type TrackedOrder = {
  number: string;
  status: string;
  total: number;
  payment: string;
  city: string;
  created: string | null;
  paid: string | null;
  dispatched: string | null;
  completed: string | null;
  items: { name: string; quantity: number; total: number; image: string }[];
};

/**
 * The four states an order passes through, as a shopper would describe them.
 *
 * Deliberately not WooCommerce's status list. "Processing" is warehouse
 * vocabulary and tells a shopper nothing about where their parcel is; these are
 * the four questions actually being asked — did you get my order, have you
 * taken the money, has it left, is it here.
 */
const STEPS = [
  { key: "placed", label: "Order placed", note: "We have your order." },
  { key: "confirmed", label: "Confirmed", note: "The seller is packing it." },
  { key: "dispatched", label: "On the way", note: "Out with the rider." },
  { key: "delivered", label: "Delivered", note: "Handed over." },
] as const;

/** Which of the four steps this order has reached. -1 for a stopped order. */
function stepFor(order: TrackedOrder): number {
  if (["cancelled", "refunded", "failed"].includes(order.status)) return -1;
  if (order.status === "completed" && !order.dispatched) return 3;
  if (order.dispatched) return order.status === "completed" ? 2 : 3;
  if (["processing", "on-hold"].includes(order.status)) return 1;
  return 0;
}

const STOPPED: Record<string, { label: string; note: string }> = {
  cancelled: { label: "Cancelled", note: "This order was stopped. Nothing is owed." },
  refunded: { label: "Refunded", note: "The money has been sent back to you." },
  failed: { label: "Payment failed", note: "The payment did not go through, so nothing was packed." },
};

const shortDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

/**
 * Order tracking, for anybody.
 *
 * ---- What this replaced ----
 *
 * A panel that showed the signed-in customer's order list and told everyone
 * else to telephone the shop. Nearly every order here is placed by a guest —
 * cash on delivery does not require an account — so the page was empty for
 * almost everyone who opened it, including everybody arriving from the "Track
 * this order" button in their own confirmation email. That button has always
 * linked to /track-order?order=NUMBER&email=ADDRESS, and the page ignored both
 * parameters.
 *
 * It reads them now, and looks the order up on arrival, so following the link
 * from an email lands on the answer rather than on a form.
 */
export default function TrackOrderPanel() {
  const params = useSearchParams();

  /* Seeded from the query string at first render rather than written into by
     an effect. The parameters are available during render, so an effect that
     copies them in is a second render for information the first one already
     had — and setState in an effect body cascades. */
  const [number, setNumber] = useState(() => params.get("order") ?? params.get("number") ?? "");
  const [contact, setContact] = useState(
    () => params.get("email") ?? params.get("phone") ?? ""
  );
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (orderNumber: string, orderContact: string) => {
    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const response = await fetch(
        `/api/track?number=${encodeURIComponent(orderNumber)}&contact=${encodeURIComponent(
          orderContact
        )}`
      );
      const payload = (await response.json().catch(() => ({}))) as
        | (TrackedOrder & { message?: string })
        | { message?: string };

      if (!response.ok) {
        setError(payload.message ?? "We could not find that order.");
        return;
      }

      setOrder(payload as TrackedOrder);
    } catch {
      setError("Could not reach the store. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* Ran once, from the link in the confirmation email. `didAuto` rather than a
     dependency on the params, because a shopper who then searches for a second
     order must not have their result thrown away by this effect re-running. */
  const didAuto = useRef(false);

  useEffect(() => {
    if (didAuto.current) return;

    const fromEmail = params.get("order") ?? params.get("number") ?? "";
    const contactFromEmail = params.get("email") ?? params.get("phone") ?? "";

    if (fromEmail && contactFromEmail) {
      didAuto.current = true;
      // Fetching on mount is what an effect is for, and `lookup` flips its
      // loading flag before awaiting — which is the synchronous setState the
      // rule objects to. Waived rather than worked around, the way lib/cart.tsx
      // and DeliveryPromise already do: the alternative is deferring the
      // spinner by a tick so a lint rule is satisfied, which would make the
      // page look frozen for that tick.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void lookup(fromEmail, contactFromEmail);
    }
  }, [params, lookup]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!number.trim() || !contact.trim()) return;
    void lookup(number.trim(), contact.trim());
  };

  const step = order ? stepFor(order) : 0;
  const stopped = order && step === -1 ? STOPPED[order.status] : null;

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-shop-line bg-white p-5 md:p-6"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr]">
          <div>
            <label htmlFor="track-number" className="mb-1.5 block text-[13px] font-semibold text-shop-ink">
              Order number
            </label>
            <input
              id="track-number"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              inputMode="numeric"
              placeholder="1563"
              required
              className="field-shop"
            />
          </div>
          <div>
            <label htmlFor="track-contact" className="mb-1.5 block text-[13px] font-semibold text-shop-ink">
              Phone or email you ordered with
            </label>
            <input
              id="track-contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="0772 123 456"
              required
              className="field-shop"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-shop mt-4 w-full py-3.5 text-[15px] sm:w-auto sm:px-10"
        >
          {loading ? "Looking…" : "Track my order"}
        </button>

        <p className="mt-3 text-[13px] text-shop-muted">
          The order number is in your confirmation email and starts with #. No account needed.
        </p>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-shop-sale/30 bg-[#fdeeeb] px-4 py-3 text-[14px] text-shop-sale"
        >
          {error}
        </p>
      )}

      {order && (
        <div className="overflow-hidden rounded-2xl border border-shop-line bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-shop-line px-5 py-4">
            <div>
              <p className="text-[18px] font-semibold text-shop-ink">Order #{order.number}</p>
              <p className="mt-0.5 text-[13px] text-shop-muted">
                Placed {shortDate(order.created)}
                {order.city ? ` · delivering to ${order.city}` : ""}
              </p>
            </div>
            <p className="text-[18px] font-semibold text-shop-ink">{formatPrice(order.total)}</p>
          </div>

          {stopped ? (
            <div className="px-5 py-6">
              <p className="text-[16px] font-semibold text-shop-ink">{stopped.label}</p>
              <p className="mt-1 text-[14px] text-shop-muted">{stopped.note}</p>
            </div>
          ) : (
            /* A vertical timeline rather than a horizontal bar: four labels
               across a 360px screen is four truncated words, and the dates
               belong beside their step rather than under a number. */
            <ol className="px-5 py-5">
              {STEPS.map((entry, index) => {
                const done = index <= step;
                const current = index === step;
                const at =
                  entry.key === "placed"
                    ? order.created
                    : entry.key === "confirmed"
                      ? order.paid
                      : entry.key === "dispatched"
                        ? order.dispatched
                        : order.completed;

                return (
                  <li key={entry.key} className="flex gap-3.5">
                    {/* The rail: a dot, and a line down to the next step that
                        is not drawn after the last one. */}
                    <div className="flex flex-col items-center">
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          done
                            ? "border-shop-success bg-shop-success text-white"
                            : "border-shop-line bg-white"
                        }`}
                      >
                        {done && (
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {index < STEPS.length - 1 && (
                        <span
                          aria-hidden
                          className={`w-0.5 flex-1 ${index < step ? "bg-shop-success" : "bg-shop-line"}`}
                        />
                      )}
                    </div>

                    <div className={`pb-6 ${index === STEPS.length - 1 ? "pb-0" : ""}`}>
                      <p
                        className={`text-[15px] ${
                          current ? "font-semibold text-shop-ink" : done ? "text-shop-ink" : "text-shop-muted"
                        }`}
                      >
                        {entry.label}
                      </p>
                      <p className="mt-0.5 text-[13px] text-shop-muted">
                        {done && at ? shortDate(at) : entry.note}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <ul className="divide-y divide-shop-line border-t border-shop-line">
            {order.items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-center gap-3 px-5 py-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-shop-surface">
                  {item.image && (
                    <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />
                  )}
                </div>
                <p className="min-w-0 flex-1 truncate text-[14px] text-shop-ink">
                  {item.quantity} × {item.name}
                </p>
                <p className="shrink-0 text-[14px] text-shop-body">{formatPrice(item.total)}</p>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3 border-t border-shop-line px-5 py-4 text-[14px]">
            <Link href="/contact" className="font-semibold text-shop-primary hover:underline">
              Something wrong? Contact us
            </Link>
            <Link href="/" className="text-shop-muted hover:text-shop-ink">
              Continue shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
