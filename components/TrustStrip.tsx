"use client";

import { formatPrice } from "@/lib/currency";
import { useCommerceTerms } from "@/lib/commerce-terms";

/* Icon paths, drawn inline so nothing can fail to load. */
const TRUCK = "M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z";
const RETURN = "M3 12a9 9 0 1 0 3-6.7M3 4v5h5";
const BADGE = "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Zm-3 9 2 2 4-4";

/**
 * Three-column reassurance band under the buy box.
 *
 * The delivery and returns figures were typed into a module-level array here —
 * "on UGX 50,000+ orders", "within 14 days" — which made this strip a third
 * independent copy of terms the owner edits in wp-admin. It now reads them from
 * `useCommerceTerms`, so a change to the threshold or the returns window moves
 * this band with the rest of the shop. See `lib/commerce-terms.tsx`.
 *
 * The component became a client one to do it, which costs nothing: it renders
 * inside `ProductPurchase`, already a client tree.
 */
export default function TrustStrip({ className = "" }: { className?: string }) {
  const { freeDeliveryFrom, returnsDays } = useCommerceTerms();

  const promises = [
    // A shop with no free-delivery offer gets the honest version of this tile
    // rather than "on UGX 0+ orders".
    freeDeliveryFrom > 0
      ? { title: "Free Delivery", copy: `on ${formatPrice(freeDeliveryFrom)}+ orders`, icon: TRUCK }
      : { title: "Nationwide Delivery", copy: "1–3 business days", icon: TRUCK },
    { title: "Free Return", copy: `within ${returnsDays} days`, icon: RETURN },
    /* This tile read "100% Authentic / international brands", and it was the
       only one of the three the shop could not stand behind. The other two
       state terms the checkout enforces; that one asserted a fact about goods
       nobody here has authenticated, and did it with a percentage to sound
       measured. What the shop does do is vet each seller before they can list,
       which is a real process with a real page behind it. */
    { title: "Vetted Sellers", copy: "checked before they can list", icon: BADGE },
  ];

  return (
    <div
      className={`grid grid-cols-3 divide-x divide-shop-line rounded-xl border border-shop-line bg-white ${className}`}
    >
      {promises.map((promise) => (
        <div key={promise.title} className="flex flex-col items-center px-2 py-4 text-center">
          <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-shop-successbg text-shop-save">
            <svg aria-hidden className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={promise.icon} />
            </svg>
          </span>
          <p className="text-[13px] font-bold leading-tight text-shop-ink">{promise.title}</p>
          <p className="mt-1 text-[12px] leading-tight text-shop-muted">{promise.copy}</p>
        </div>
      ))}
    </div>
  );
}
