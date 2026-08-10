"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * The Super Deals clock, counting to the next local midnight.
 *
 * That is a real deadline the shop can honour: the deals rail is built from
 * what is genuinely on sale in WooCommerce right now, and at midnight it is
 * rebuilt. A countdown that resets on every page load is the oldest trick on the
 * internet and shoppers have learned to read it as a lie.
 *
 * Renders dashes until mounted — the remaining time depends on the viewer's own
 * clock, so rendering a real figure on the server would guarantee a hydration
 * mismatch.
 */
export default function CountdownBlocks() {
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

  const parts =
    remaining === null
      ? ["--", "--", "--"]
      : [
          pad(Math.floor(remaining / 3_600_000)),
          pad(Math.floor((remaining % 3_600_000) / 60_000)),
          pad(Math.floor((remaining % 60_000) / 1000)),
        ];

  return (
    <span
      role="timer"
      aria-label="Time left on today's deals"
      className="flex items-center gap-1"
    >
      {parts.map((part, index) => (
        <span key={index} className="flex items-center gap-1">
          <span className="price rounded bg-shop-sale px-1.5 py-0.5 text-[12px] leading-tight text-white tabular-nums">
            {part}
          </span>
          {index < 2 && <span aria-hidden className="text-[12px] font-bold">:</span>}
        </span>
      ))}
    </span>
  );
}
