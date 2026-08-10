"use client";

import { useState } from "react";

export type TopProduct = { id: number; name: string; units: number; revenue: number };

/**
 * Best sellers by revenue — magnitude comparison, so one hue and bar length do
 * the work. The value rides the tip of each bar; hover adds units sold.
 */
export default function TopProductsChart({
  products,
  formatValue,
}: {
  products: TopProduct[];
  formatValue: (value: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (products.length === 0) {
    return (
      <div className="viz-root rounded border border-bfl-line bg-white p-4">
        <h2 className="text-[16px] font-extrabold text-[color:var(--text-primary)]">Best sellers</h2>
        <p className="mt-6 text-center text-[14px] text-[color:var(--text-muted)]">
          No products have sold in this period yet.
        </p>
      </div>
    );
  }

  const max = Math.max(...products.map((p) => p.revenue), 1);

  return (
    <div className="viz-root rounded border border-bfl-line bg-white p-4">
      <h2 className="text-[16px] font-extrabold text-[color:var(--text-primary)]">Best sellers</h2>
      <p className="text-[13px] text-[color:var(--text-secondary)]">By revenue in the selected period.</p>

      <ul className="mt-4 space-y-3">
        {products.map((product) => {
          const width = (product.revenue / max) * 100;
          return (
            <li
              key={product.id}
              onPointerEnter={() => setHovered(product.id)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(product.id)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              className="group relative rounded outline-none focus-visible:ring-2 focus-visible:ring-bfl-yellow"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[14px] text-[color:var(--text-primary)]">{product.name}</p>
                <p
                  className="shrink-0 text-[14px] font-semibold text-[color:var(--text-primary)]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatValue(product.revenue)}
                </p>
              </div>

              {/* Bar: capped thickness, 4px rounded data-end, square at baseline */}
              <div className="mt-1.5 h-3 w-full">
                <div
                  className="h-3 transition-opacity group-hover:opacity-85"
                  style={{
                    width: `${Math.max(width, 1.5)}%`,
                    background: "var(--series-1)",
                    borderRadius: "0 4px 4px 0",
                  }}
                />
              </div>

              {hovered === product.id && (
                <div className="pointer-events-none absolute -top-1 right-0 z-10 -translate-y-full rounded border border-bfl-line bg-white px-3 py-2 shadow-md">
                  <p className="text-[16px] font-semibold text-[color:var(--text-primary)]">
                    {formatValue(product.revenue)}
                  </p>
                  <p className="text-[13px] text-[color:var(--text-secondary)]">
                    {product.units} {product.units === 1 ? "unit" : "units"} sold
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
