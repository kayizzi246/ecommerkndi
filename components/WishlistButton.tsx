"use client";

import { useWishlist } from "@/lib/wishlist";

type Props = {
  productId: number;
  name: string;
  image: string;
  price: number;
  className?: string;
  iconClassName?: string;
};

export default function WishlistButton({
  productId,
  name,
  image,
  price,
  className = "",
  iconClassName = "",
}: Props) {
  const { isWishlisted, toggle } = useWishlist();
  const active = isWishlisted(productId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle({ productId, name, image, price });
      }}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      className={`flex items-center justify-center transition-all active:scale-90 ${className}`}
    >
      {active ? (
        <svg className={iconClassName || "w-5 h-5"} viewBox="0 0 24 24" fill="#ff4747" stroke="#ff4747" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
          />
        </svg>
      ) : (
        <svg className={iconClassName || "w-5 h-5"} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
          />
        </svg>
      )}
    </button>
  );
}

