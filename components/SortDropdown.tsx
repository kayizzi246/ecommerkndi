"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";

const SORT_OPTIONS = [
  { value: "", label: "Best match" },
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "discount", label: "Biggest discount" },
  { value: "price_asc", label: "Price low to high" },
  { value: "price_desc", label: "Price high to low" },
];

export default function SortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "";

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("sort", value);
      } else {
        params.delete("sort");
      }
      // Reset to page 1 when sorting changes
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="hidden text-shop-muted sm:inline">Sort by:</span>
      <select
        value={currentSort}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Sort products"
        className="cursor-pointer rounded-lg border border-shop-line bg-white px-3 py-2 text-[13px] text-shop-ink focus:border-shop-ink focus:outline-none"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

