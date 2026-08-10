"use client";

export const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "mtd", label: "Month to date" },
  { value: "ytd", label: "Year to date" },
] as const;

export type RangeValue = (typeof RANGES)[number]["value"];

/**
 * Date-range presets. Filters live in one row above the content they scope, so
 * every tile, chart and table on the page always reports the same slice.
 */
export default function RangeFilter({
  value,
  onChange,
}: {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
}) {
  return (
    <div role="group" aria-label="Date range" className="flex flex-wrap gap-1">
      {RANGES.map((range) => (
        <button
          key={range.value}
          type="button"
          aria-pressed={value === range.value}
          onClick={() => onChange(range.value)}
          className={`rounded border px-3 py-1.5 text-[13px] transition-colors ${
            value === range.value
              ? "border-black bg-black font-semibold text-white"
              : "border-bfl-line bg-white text-[#333] hover:border-[#b0b0b0]"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
