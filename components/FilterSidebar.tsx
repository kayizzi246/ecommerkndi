"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { formatPrice } from "@/lib/currency";

type Brand = { slug: string; name: string; count: number };

type Props = {
  /** Brand facet, counted from the products on the page. */
  brands?: Brand[];
  onClose?: () => void;
  className?: string;
};

/**
 * Listing filters. Every control here maps to a query parameter that
 * `filterProducts` understands, so nothing in this panel is decorative.
 */
export default function FilterSidebar({ brands = [], onClose, className = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMin = searchParams.get("min_price") ?? "";
  const currentMax = searchParams.get("max_price") ?? "";
  const inStockOnly = searchParams.get("stock") === "1";
  const onSaleOnly = searchParams.get("sale") === "1";
  const currentBrand = searchParams.get("brand") ?? "";

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
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    ["min_price", "max_price", "stock", "sale", "brand", "page"].forEach((key) =>
      params.delete(key)
    );
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    onClose?.();
  }, [router, pathname, searchParams, onClose]);

  const activeCount =
    (currentMin ? 1 : 0) +
    (currentMax ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    (currentBrand ? 1 : 0);

  return (
    <aside className={`text-[13px] ${className}`}>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-shop-ink">
          Filters{" "}
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-shop-ink px-2 py-0.5 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[12px] text-shop-body underline underline-offset-4 hover:text-shop-ink"
            >
              Clear all
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="text-lg leading-none text-shop-muted hover:text-shop-ink"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Availability */}
      <section className="border-t border-shop-line py-5">
        <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-shop-muted">
          Availability
        </h4>
        <label className="flex cursor-pointer items-center gap-2.5 py-1 text-shop-body">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={() => applyFilters({ stock: inStockOnly ? undefined : "1" })}
            className="h-4 w-4 rounded accent-shop-ink"
          />
          In stock only
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 py-1 text-shop-body">
          <input
            type="checkbox"
            checked={onSaleOnly}
            onChange={() => applyFilters({ sale: onSaleOnly ? undefined : "1" })}
            className="h-4 w-4 rounded accent-shop-ink"
          />
          On sale
        </label>
      </section>

      {/* Price */}
      <section className="border-t border-shop-line py-5">
        <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-shop-muted">
          Price
        </h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            placeholder="Min"
            aria-label="Minimum price"
            className="field-shop px-2.5 py-2 text-[13px]"
          />
          <span className="text-shop-muted">–</span>
          <input
            type="number"
            min={0}
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            placeholder="Max"
            aria-label="Maximum price"
            className="field-shop px-2.5 py-2 text-[13px]"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            applyFilters({
              min_price: localMin || undefined,
              max_price: localMax || undefined,
            })
          }
          className="btn-shop-outline mt-2.5 w-full py-2 text-[12px]"
        >
          Apply price
        </button>
        {(currentMin || currentMax) && (
          <p className="mt-2 text-[12px] text-shop-muted">
            Showing {currentMin ? formatPrice(Number(currentMin)) : "any"} –{" "}
            {currentMax ? formatPrice(Number(currentMax)) : "any"}
          </p>
        )}
      </section>

      {/* Brand facet */}
      {brands.length > 0 && (
        <section className="border-t border-shop-line py-5">
          <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-shop-muted">
            Category
          </h4>
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {brands.map((brand) => {
              const active = currentBrand === brand.slug;
              return (
                <li key={brand.slug}>
                  <button
                    type="button"
                    onClick={() => applyFilters({ brand: active ? undefined : brand.slug })}
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      active
                        ? "bg-shop-ink font-medium text-white"
                        : "text-shop-body hover:bg-shop-surface"
                    }`}
                  >
                    <span className="truncate">{brand.name}</span>
                    <span className={active ? "text-white/70" : "text-shop-muted"}>
                      {brand.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
