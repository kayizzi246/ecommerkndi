"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";

const SORT_OPTIONS = [
  { value: "", label: "Best Match" },
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price Low → High" },
  { value: "price_desc", label: "Price High → Low" },
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
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 hidden sm:inline">Sort by:</span>
      <select
        value={currentSort}
        onChange={(e) => handleChange(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-market cursor-pointer"
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

