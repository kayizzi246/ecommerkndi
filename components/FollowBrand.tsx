"use client";

import { useState } from "react";

/**
 * The bordered "Brand — Follow for new brand updates" panel that sits directly
 * under Add to Cart on the Brands For Less product page.
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
    <div className="mt-5 flex items-center justify-between gap-4 border border-bfl-line px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-black">{brandName}</p>
        <p className="mt-0.5 text-[12px] text-bfl-grey">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => setFollowing((value) => !value)}
        aria-pressed={following}
        className={`shrink-0 border px-8 py-2 text-[13px] font-bold transition-colors ${
          following
            ? "border-black bg-black text-white"
            : "border-bfl-ink text-bfl-ink hover:bg-bfl-surface"
        }`}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}
