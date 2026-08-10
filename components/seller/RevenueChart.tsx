"use client";

import { useMemo, useRef, useState } from "react";

export type RevenuePoint = { date: string; revenue: number; orders: number };

type Props = {
  data: RevenuePoint[];
  formatValue: (value: number) => string;
};

const W = 900;
const H = 260;
const PAD = { top: 16, right: 20, bottom: 30, left: 64 };

/**
 * Daily revenue, single series. One measure, one axis, one hue — a crosshair
 * snaps to the nearest day and the tooltip carries both revenue and order
 * count, so no second y-scale is ever needed.
 */
export default function RevenueChart({ data, formatValue }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const { ticks, max, points, areaPath, linePath } = useMemo(() => {
    const peak = Math.max(...data.map((d) => d.revenue), 0);
    const niceMax = niceCeiling(peak);
    const step = niceMax / 4;
    const axisTicks = [0, step, step * 2, step * 3, niceMax];

    const coords = data.map((d, i) => {
      const x = PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
      const y = PAD.top + plotH - (niceMax === 0 ? 0 : (d.revenue / niceMax) * plotH);
      return { x, y, ...d };
    });

    const line = coords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");
    const area =
      coords.length > 0
        ? `${line} L${coords[coords.length - 1].x.toFixed(1)} ${PAD.top + plotH} L${coords[0].x.toFixed(1)} ${PAD.top + plotH} Z`
        : "";

    return { ticks: axisTicks, max: niceMax, points: coords, areaPath: area, linePath: line };
  }, [data, plotW, plotH]);

  if (data.length === 0) {
    return (
      <div className="viz-root rounded border border-bfl-line bg-white p-10 text-center text-[14px] text-[color:var(--text-muted)]">
        No sales recorded in this period yet.
      </div>
    );
  }

  const trackPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((event.clientX - rect.left) / rect.width) * W;
    // Snap to the nearest day so the reader aims at a date, not a 2px line.
    let nearest = 0;
    let bestDistance = Infinity;
    points.forEach((p, i) => {
      const distance = Math.abs(p.x - relX);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  const active = hoverIndex === null ? null : points[hoverIndex];

  return (
    <div className="viz-root rounded border border-bfl-line bg-white p-4">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-extrabold text-[color:var(--text-primary)]">Revenue by day</h2>
          <p className="text-[13px] text-[color:var(--text-secondary)]">
            Your share of order totals, before commission.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((open) => !open)}
          className="shrink-0 rounded border border-bfl-line px-2.5 py-1 text-[13px] text-[color:var(--text-secondary)] hover:border-[#b0b0b0]"
          aria-expanded={showTable}
        >
          {showTable ? "Hide table" : "View as table"}
        </button>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          role="img"
          aria-label="Daily revenue for the selected period"
          onPointerMove={trackPointer}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {/* Gridlines + y ticks */}
          {ticks.map((tick) => {
            const y = PAD.top + plotH - (max === 0 ? 0 : (tick / max) * plotH);
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--gridline)"
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--text-muted)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {compact(tick)}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
            stroke="var(--baseline)"
            strokeWidth="1"
          />

          {/* Area wash + line */}
          <path d={areaPath} fill="var(--series-1)" fillOpacity="0.1" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* X labels — first, middle, last only, so they never collide */}
          {[0, Math.floor(points.length / 2), points.length - 1]
            .filter((index, i, all) => all.indexOf(index) === i)
            .map((index) => (
              <text
                key={index}
                x={points[index].x}
                y={H - 8}
                textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                fontSize="11"
                fill="var(--text-muted)"
              >
                {shortDate(points[index].date)}
              </text>
            ))}

          {/* Crosshair */}
          {active && (
            <>
              <line
                x1={active.x}
                x2={active.x}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--baseline)"
                strokeWidth="1"
              />
              <circle
                cx={active.x}
                cy={active.y}
                r="5"
                fill="var(--series-1)"
                stroke="var(--surface-1)"
                strokeWidth="2"
              />
            </>
          )}
        </svg>

        {/* Tooltip — value leads, label follows */}
        {active && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded border border-bfl-line bg-white px-3 py-2 shadow-md"
            style={{
              left: `${(active.x / W) * 100}%`,
              transform: active.x > W * 0.6 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <p className="text-[12px] text-[color:var(--text-muted)]">{longDate(active.date)}</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="inline-block h-0.5 w-4" style={{ background: "var(--series-1)" }} />
              <span className="text-[16px] font-semibold text-[color:var(--text-primary)]">
                {formatValue(active.revenue)}
              </span>
            </p>
            <p className="text-[13px] text-[color:var(--text-secondary)]">
              {active.orders} {active.orders === 1 ? "order" : "orders"}
            </p>
          </div>
        )}
      </div>

      {showTable && (
        <div className="mt-4 max-h-64 overflow-y-auto border-t border-bfl-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white text-left text-[color:var(--text-secondary)]">
              <tr>
                <th className="py-2 font-semibold">Date</th>
                <th className="py-2 text-right font-semibold">Revenue</th>
                <th className="py-2 text-right font-semibold">Orders</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {data.map((row) => (
                <tr key={row.date} className="border-t border-bfl-line">
                  <td className="py-1.5">{longDate(row.date)}</td>
                  <td className="py-1.5 text-right">{formatValue(row.revenue)}</td>
                  <td className="py-1.5 text-right">{row.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function niceCeiling(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function longDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
