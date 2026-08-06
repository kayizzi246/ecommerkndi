"use client";

type Props = {
  label: string;
  value: string;
  /** Signed percentage change against the comparison period. */
  delta?: number | null;
  deltaPeriod?: string;
  /** Sparkline series; drawn in the accent hue when present. */
  trend?: number[];
  hint?: string;
};

/**
 * Stat tile: label · value · delta · sparkline. A single headline number is a
 * tile, never a one-bar chart.
 */
export default function StatTile({ label, value, delta, deltaPeriod, trend, hint }: Props) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = hasDelta && delta > 0;
  const flat = hasDelta && Math.round(delta * 10) === 0;

  return (
    <div className="viz-root rounded border border-bfl-line bg-white p-4">
      <p className="text-[12px] text-[color:var(--text-secondary)]">{label}</p>

      <p className="mt-1.5 text-[26px] font-semibold leading-none text-[color:var(--text-primary)]">
        {value}
      </p>

      {hasDelta && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px]">
          <span
            aria-hidden
            className="text-[13px] leading-none"
            style={{ color: flat ? "var(--text-muted)" : up ? "var(--delta-good)" : "var(--status-critical)" }}
          >
            {flat ? "→" : up ? "↑" : "↓"}
          </span>
          <span
            className="font-bold"
            style={{ color: flat ? "var(--text-muted)" : up ? "var(--delta-good)" : "var(--status-critical)" }}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
          <span className="text-[color:var(--text-muted)]">{deltaPeriod ?? "vs previous period"}</span>
        </p>
      )}

      {hint && !hasDelta && <p className="mt-2 text-[12px] text-[color:var(--text-muted)]">{hint}</p>}

      {trend && trend.length > 1 && <Sparkline values={trend} />}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 200;
  const height = 34;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend across the last ${values.length} days`}
      className="mt-3 h-[34px] w-full"
    >
      <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="4" fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
    </svg>
  );
}
