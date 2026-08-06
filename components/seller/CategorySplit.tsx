"use client";

import { useMemo, useState } from "react";

export type CategoryDatum = { name: string; revenue: number };

/**
 * Revenue split by category — part-to-whole, so a single stacked bar.
 *
 * Series are seated in the fixed categorical order (never cycled) and the tail
 * beyond five folds into "Other" rather than inventing a sixth hue. Three of
 * the five hues fall under 3:1 against white, so the legend carries the value
 * for every series and a table view is available: that is the documented relief
 * for the validator's contrast warning, not an optional extra.
 */

const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
const OTHER = "#767676";

export default function CategorySplit({
  data,
  formatValue,
}: {
  data: CategoryDatum[];
  formatValue: (value: number) => string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const series = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.revenue - a.revenue);
    const head = sorted.slice(0, 5);
    const tail = sorted.slice(5);
    const rows = head.map((row, i) => ({ ...row, color: SLOTS[i] }));
    if (tail.length > 0) {
      rows.push({
        name: "Other",
        revenue: tail.reduce((sum, row) => sum + row.revenue, 0),
        color: OTHER,
      });
    }
    return rows;
  }, [data]);

  const total = series.reduce((sum, row) => sum + row.revenue, 0);

  if (total <= 0) {
    return (
      <div className="viz-root rounded border border-bfl-line bg-white p-4">
        <h2 className="text-[15px] font-bold text-[color:var(--text-primary)]">Revenue by category</h2>
        <p className="mt-6 text-center text-[13px] text-[color:var(--text-muted)]">
          Nothing to split yet — your first sale will fill this in.
        </p>
      </div>
    );
  }

  return (
    <div className="viz-root rounded border border-bfl-line bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-[color:var(--text-primary)]">Revenue by category</h2>
          <p className="text-[12px] text-[color:var(--text-secondary)]">
            Share of {formatValue(total)} in the selected period.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((open) => !open)}
          className="shrink-0 rounded border border-bfl-line px-2.5 py-1 text-[12px] text-[color:var(--text-secondary)] hover:border-[#b0b0b0]"
          aria-expanded={showTable}
        >
          {showTable ? "Hide table" : "View as table"}
        </button>
      </div>

      {/* Stacked bar — 2px surface gaps separate the segments */}
      <div className="flex h-6 w-full gap-[2px] overflow-hidden">
        {series.map((row) => (
          <div
            key={row.name}
            onPointerEnter={() => setHovered(row.name)}
            onPointerLeave={() => setHovered(null)}
            title={`${row.name}: ${formatValue(row.revenue)}`}
            className="h-6 transition-opacity"
            style={{
              width: `${(row.revenue / total) * 100}%`,
              background: row.color,
              opacity: hovered && hovered !== row.name ? 0.55 : 1,
            }}
          />
        ))}
      </div>

      {/* Legend carries the value for every series (contrast relief) */}
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {series.map((row) => (
          <li
            key={row.name}
            onPointerEnter={() => setHovered(row.name)}
            onPointerLeave={() => setHovered(null)}
            className="flex items-center gap-2 text-[12px]"
          >
            <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: row.color }} />
            <span className="min-w-0 flex-1 truncate text-[color:var(--text-secondary)]">{row.name}</span>
            <span
              className="shrink-0 font-bold text-[color:var(--text-primary)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatValue(row.revenue)}
            </span>
            <span className="w-10 shrink-0 text-right text-[color:var(--text-muted)]">
              {Math.round((row.revenue / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>

      {showTable && (
        <table className="mt-4 w-full border-t border-bfl-line text-[12px]">
          <thead className="text-left text-[color:var(--text-secondary)]">
            <tr>
              <th className="py-2 font-bold">Category</th>
              <th className="py-2 text-right font-bold">Revenue</th>
              <th className="py-2 text-right font-bold">Share</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {series.map((row) => (
              <tr key={row.name} className="border-t border-bfl-line">
                <td className="py-1.5">{row.name}</td>
                <td className="py-1.5 text-right">{formatValue(row.revenue)}</td>
                <td className="py-1.5 text-right">{Math.round((row.revenue / total) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
