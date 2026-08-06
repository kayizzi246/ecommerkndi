"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const RATING_OPTIONS = [4, 3, 2, 1];

type Props = {
  minPrice?: number;
  maxPrice?: number;
  onClose?: () => void;
  className?: string;
};

export default function FilterSidebar({
  minPrice = 0,
  maxPrice = 500000,
  onClose,
  className = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMin = Number(searchParams.get("min_price") || minPrice);
  const currentMax = Number(searchParams.get("max_price") || maxPrice);
  const currentRating = Number(searchParams.get("rating") || 0);

  const [localMin, setLocalMin] = useState(currentMin);
  const [localMax, setLocalMax] = useState(currentMax);

  const applyFilters = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push(pathname);
    onClose?.();
  }, [router, pathname, onClose]);

  const hasActiveFilters =
    currentMin > minPrice || currentMax < maxPrice || currentRating > 0;

  return (
    <aside className={`border border-bfl-line bg-white p-4 ${className}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-bfl-line pb-3">
        <h3 className="text-[14px] font-bold text-black">Filters</h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="link-bfl text-[12px] font-bold">
              Clear all
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="text-lg leading-none text-bfl-grey hover:text-black"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Price range */}
      <div className="mb-5">
        <h4 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[#333]">
          Price range
        </h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={localMin}
            onChange={(e) => setLocalMin(Number(e.target.value))}
            placeholder="Min"
            aria-label="Minimum price"
            className="w-full border border-bfl-line px-2 py-2 text-[13px] focus:border-black focus:outline-none"
          />
          <span className="text-bfl-grey">—</span>
          <input
            type="number"
            value={localMax}
            onChange={(e) => setLocalMax(Number(e.target.value))}
            placeholder="Max"
            aria-label="Maximum price"
            className="w-full border border-bfl-line px-2 py-2 text-[13px] focus:border-black focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            applyFilters({ min_price: String(localMin), max_price: String(localMax) })
          }
          className="mt-2 w-full border border-bfl-line py-2 text-center text-[12px] font-bold text-[#333] transition-colors hover:border-black"
        >
          Apply price
        </button>
      </div>

      {/* Rating */}
      <div className="mb-5">
        <h4 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[#333]">Rating</h4>
        <ul className="space-y-1">
          {RATING_OPTIONS.map((r) => {
            const active = currentRating === r;
            return (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => applyFilters({ rating: active ? undefined : String(r) })}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] transition-colors ${
                    active ? "bg-bfl-yellow font-bold text-black" : "hover:bg-bfl-surface"
                  }`}
                >
                  <span className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg
                        key={i}
                        className={`h-3.5 w-3.5 ${i < r ? "text-bfl-yellow" : "text-[#dcdcdc]"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </span>
                  <span className="text-[12px] text-bfl-grey">&amp; up</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {hasActiveFilters && (
        <div className="border-t border-bfl-line pt-3">
          <button type="button" onClick={clearFilters} className="btn-bfl w-full py-2.5 text-[12px]">
            Reset all filters
          </button>
        </div>
      )}
    </aside>
  );
}
