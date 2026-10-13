"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * The Super Deals clock: three large dark tiles counting to local midnight,
 * when the day's prices are rechecked. Dashes until the first tick so the
 * server and the browser render the same markup.
 */
export default function SaleCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      setRemaining(Math.max(0, midnight.getTime() - now.getTime()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const parts: [string, string][] =
    remaining === null
      ? [["--", "hrs"], ["--", "min"], ["--", "sec"]]
      : [
          [pad(Math.floor(remaining / 3_600_000)), "hrs"],
          [pad(Math.floor((remaining % 3_600_000) / 60_000)), "min"],
          [pad(Math.floor((remaining % 60_000) / 1000)), "sec"],
        ];

  return (
    <span role="timer" aria-label="Time left on today's deals" className="flex items-start gap-1.5">
      {parts.map(([value, unit], index) => (
        <span key={unit} className="flex items-start gap-1.5">
          <span className="flex flex-col items-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#111111] text-[20px] font-bold leading-none text-white tabular-nums md:h-12 md:w-12 md:text-[22px]">
              {value}
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7a5a00]">
              {unit}
            </span>
          </span>
          {index < 2 && (
            <span aria-hidden className="pt-2.5 text-[18px] font-bold text-[#111111]">
              :
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
