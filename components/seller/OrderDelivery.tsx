"use client";

import { useState } from "react";
import type { SellerOrder } from "@/lib/seller";
import { formatUgPhone, normaliseUgPhone } from "@/lib/phone";

/**
 * Where the parcel goes, and how to reach the person waiting for it.
 *
 * The Seller Centre used to show a first name and a city, which is not enough
 * information to deliver anything — so every seller here worked from the email
 * instead, or rang the marketplace to ask. This is that missing half of the
 * order, and it is deliberately built around the three things a seller actually
 * does with it: call the buyer, open the pin, and copy the address into
 * whatever the boda rider uses.
 *
 * The buttons are `<a>` elements with real schemes rather than click handlers.
 * On the phone this is mostly read on, `tel:` and `https://wa.me/` open the
 * apps directly; on a laptop they degrade to something the browser can offer.
 */
export default function OrderDelivery({ order }: { order: SellerOrder }) {
  const [copied, setCopied] = useState(false);

  const lines = [order.address_1, order.address_2, order.city].filter(
    (line) => line && line.trim() !== ""
  );

  /* `normaliseUgPhone` gives `+2567…`, which is exactly what wa.me wants
     without the plus. A number it cannot parse — a landline, or something from
     outside Uganda — still gets a tel: link, because a seller who can read it
     can dial it; only WhatsApp is dropped, since a malformed wa.me link opens
     an error page rather than a chat. */
  const normalised = order.phone ? normaliseUgPhone(order.phone) : null;

  const copyAddress = async () => {
    const text = [order.customer, order.phone, ...lines].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused outside a secure context and in some
      // in-app browsers. The address is on screen either way, so there is
      // nothing to recover from and nothing worth interrupting them about.
    }
  };

  return (
    <div className="rounded border border-bfl-line bg-white p-4">
      <p className="text-[13px] font-semibold text-black">Deliver to</p>

      <p className="mt-2 text-[14px] font-semibold text-black">{order.customer || "—"}</p>

      {order.phone && (
        <p className="mt-0.5 text-[14px] text-[#333]" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatUgPhone(order.phone)}
        </p>
      )}

      {lines.length > 0 ? (
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#333]">
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-1.5 text-[14px] text-bfl-grey">
          No street address on this order — use the map pin or call the buyer.
        </p>
      )}

      {order.note && (
        <p className="mt-3 rounded bg-[#fff6dd] px-3 py-2 text-[13px] text-[#8a6100]">
          <span className="font-semibold">The buyer asked:</span> {order.note}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {order.phone && (
          <a
            href={`tel:${order.phone.replace(/[^\d+]/g, "")}`}
            className="rounded border border-black bg-black px-3 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
          >
            Call
          </a>
        )}

        {normalised && (
          <a
            href={`https://wa.me/${normalised.replace("+", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-bfl-line px-3 py-1.5 text-[13px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0]"
          >
            WhatsApp
          </a>
        )}

        {order.map_url && (
          <a
            href={order.map_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-bfl-line px-3 py-1.5 text-[13px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0]"
          >
            Open the pin
          </a>
        )}

        <button
          type="button"
          onClick={copyAddress}
          className="rounded border border-bfl-line px-3 py-1.5 text-[13px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0]"
        >
          {copied ? "Copied" : "Copy address"}
        </button>
      </div>

      {order.payment && (
        <p className="mt-3 text-[13px] text-bfl-grey">
          Paid by <span className="text-[#333]">{order.payment}</span>
        </p>
      )}
    </div>
  );
}
