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
    const params = new URLSearchParams();
    router.push(pathname);
    onClose?.();
  }, [router, pathname, onClose]);

  const hasActiveFilters =
    currentMin > minPrice || currentMax < maxPrice || currentRating > 0;

  return (
    <aside
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-bold uppercase tracking-wider">Filters</h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-market hover:underline"
            >
              Clear all
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-black text-lg leading-none">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Price Range */}
      <div className="mb-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">
          Price range
        </h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={localMin}
            onChange={(e) => setLocalMin(Number(e.target.value))}
            placeholder="Min"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-market"
          />
          <span className="text-gray-400">—</span>
          <input
            type="number"
            value={localMax}
            onChange={(e) => setLocalMax(Number(e.target.value))}
            placeholder="Max"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-market"
          />
        </div>
        <button
          type="button"
          onClick={() => applyFilters({ min_price: String(localMin), max_price: String(localMax) })}
          className="mt-2 w-full text-center text-xs text-market hover:underline py-1"
        >
          Apply price
        </button>
      </div>

      {/* Rating Filter */}
      <div className="mb-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">
          Rating
        </h4>
        <ul className="space-y-2">
          {RATING_OPTIONS.map((r) => {
            const active = currentRating === r;
            return (
              <li key={r}>
                <button
                  type="button"
                  onClick={() =>
                    applyFilters({
                      rating: active ? undefined : String(r),
                    })
                  }
                  className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    active ? "bg-market/10 text-market font-semibold" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg
                        key={i}
                        className={`w-3.5 h-3.5 ${i < r ? "text-star" : "text-gray-300"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </span>
                  <span className="text-xs text-gray-500">& up</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full bg-market text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded hover:bg-market-dark transition-colors"
          >
            Reset all filters
          </button>
        </div>
      )}
    </aside>
  );
}

