"use client";

import { useCommerceTerms } from "@/lib/commerce-terms";

/**
 * "Free shipping" in bold green on a grid tile, the way the big marketplaces
 * print it — but only on items whose own price clears the free-delivery
 * threshold set in wp-admin, so the tile never promises what the checkout
 * will not honour. Anything else renders `fallback` (the delivery date line)
 * in its place.
 */
export default function TileFreeDelivery({
  price,
  fallback = null,
}: {
  price: number;
  fallback?: React.ReactNode;
}) {
  const { freeDeliveryFrom } = useCommerceTerms();

  if (freeDeliveryFrom <= 0 || price < freeDeliveryFrom) {
    return <>{fallback}</>;
  }

  return (
    <p className="flex items-center gap-1 truncate pt-1 text-[12px] font-bold leading-4 text-[#0a8a3a]">
      <svg aria-hidden className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M2 6h12v10H2V6Zm12 4h4.2L21 13v3h-7v-6Z" />
        <circle cx="6" cy="17.5" r="1.8" />
        <circle cx="17" cy="17.5" r="1.8" />
      </svg>
      Free shipping
    </p>
  );
}
