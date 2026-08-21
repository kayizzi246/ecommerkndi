"use client";

import { formatPrice } from "@/lib/currency";
import { useCommerceTerms } from "@/lib/commerce-terms";

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
      ? { title: "Free Delivery", copy: `on ${formatPrice(freeDeliveryFrom)}+ orders` }
      : { title: "Nationwide Delivery", copy: "1–3 business days" },
    { title: "Free Return", copy: `within ${returnsDays} days` },
    /* This tile read "100% Authentic / international brands", and it was the
       only one of the three the shop could not stand behind. The other two
       state terms the checkout enforces; that one asserted a fact about goods
       nobody here has authenticated, and did it with a percentage to sound
       measured. What the shop does do is vet each seller before they can list,
       which is a real process with a real page behind it. */
    { title: "Vetted Sellers", copy: "checked before they can list" },
  ];

  return (
    <div
      className={`grid grid-cols-3 divide-x divide-shop-line rounded-xl border border-shop-line bg-shop-cream ${className}`}
    >
      {promises.map((promise) => (
        <div key={promise.title} className="px-3 py-4 text-center">
          <p className="text-[14px] font-semibold leading-tight text-shop-ink">{promise.title}</p>
          <p className="mt-1 text-[12px] leading-tight text-shop-muted">{promise.copy}</p>
        </div>
      ))}
    </div>
  );
}
