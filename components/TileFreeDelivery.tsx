"use client";

import { useCommerceTerms } from "@/lib/commerce-terms";

/**
 * "Free delivery" on the tiles that have earned it on their own.
 *
 * The threshold is the shop owner's, editable in wp-admin, and it is the same
 * number the cart counts down to and the checkout charges against — read
 * through `useCommerceTerms` rather than typed in here, for the reason spelled
 * out at the top of `lib/commerce-terms.tsx`: a promise on a tile that the
 * checkout then breaks is the most expensive kind of drift this shop has.
 *
 * This is a client component ONLY because that context is one — `ProductCard`
 * itself stays a server component, and this renders nothing at all on the
 * majority of tiles, so the boundary costs a grid almost nothing.
 *
 * A single item at or above the threshold qualifies by itself, so this is a
 * fact about the product rather than a claim about the shop: the delivery line
 * that used to sit on every tile said the same thing forty times and was
 * deleted for it. This one is true of some products and not others, which is
 * the test any row on a tile has to pass.
 */
export default function TileFreeDelivery({ price }: { price: number }) {
  const { freeDeliveryFrom } = useCommerceTerms();

  if (freeDeliveryFrom <= 0 || price < freeDeliveryFrom) {
    return null;
  }

  return (
    <p className="truncate pt-px text-[10px] font-semibold leading-[14px] text-shop-muted">
      Free delivery
    </p>
  );
}
