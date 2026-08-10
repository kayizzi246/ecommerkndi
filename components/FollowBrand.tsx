"use client";

import { useState } from "react";

/**
 * The "Brand — Follow for new brand updates" panel that sits directly under
 * Add to Cart on the product page.
 */
export default function FollowBrand({
  brandName,
  subtitle = "Follow for new brand updates",
}: {
  brandName: string;
  subtitle?: string;
}) {
  const [following, setFollowing] = useState(false);

  return (
    <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-shop-line px-4 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-shop-ink">{brandName}</p>
        <p className="mt-0.5 text-[13px] text-shop-muted">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => setFollowing((value) => !value)}
        aria-pressed={following}
        className={`shrink-0 rounded-lg border px-7 py-2 text-[14px] font-semibold transition-colors ${
          following
            ? "border-shop-primary bg-shop-primary-soft text-shop-primary"
            : "border-shop-line text-shop-body hover:border-shop-primary hover:text-shop-primary"
        }`}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}
