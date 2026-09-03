"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * The hour of day the deal window turns over, on the viewer's own clock.
 *
 * Midnight. The whole cycle is 24 hours long — it opens at 00:00 showing
 * 24:00:00 and runs down to zero, at which point the rails are rebuilt from
 * whatever WooCommerce has on sale on the new day.
 *
 * It is a fixed wall-clock time rather than "24 hours from now" on purpose, and
 * the distinction is the entire honesty of the component. A window anchored to
 * the visit restarts at a full day for every shopper on every page load, which
 * is the oldest trick on the internet and one shoppers have long since learned
 * to read as a lie. Anchored to midnight, two people looking at the shop at the
 * same moment see the same number, and the number is true — which does mean
 * somebody arriving at 22:45 correctly sees 01:15:00 rather than a fresh day.
 *
 * Change this to move the reset: 18 would end the day's deals at 6pm.
 */
const RESET_HOUR = 24;

/**
 * The deals clock — one 24-hour cycle, counting down to the next reset.
 *
 * Renders dashes until mounted: the remaining time depends on the viewer's own
 * clock, so rendering a real figure on the server would guarantee a hydration
 * mismatch.
 */
export default function CountdownBlocks() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const reset = new Date(now);
      reset.setHours(RESET_HOUR, 0, 0, 0);
      setRemaining(Math.max(0, reset.getTime() - now.getTime()));
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
      {/* ---- Red, not brand orange ----

          The blocks were filled with `shop-primary-ink`, which is the colour
          every other promotional chip in the shop wears. That made the clock
          one more orange object on a page that already has a masthead, a nav,
          a discount flag and a call-to-action in the same hue — and a
          countdown is the one thing here that is not merchandising. It is a
          deadline.

          `--color-shop-price-was` is the shop's one commercial red, already
          carrying the struck-through original on every reduced price. Reusing
          it means the panel spends no new hue: red is what is coming off the
          price, and red is what says how long for. It clears 5.5:1 behind
          white type at this size, which the note on the token records.

          The colon between the blocks takes the same red rather than the ink
          it inherited — an orange-free clock with two near-black colons in it
          reads as three separate objects instead of one time. */}
      {parts.map((part, index) => (
        <span key={index} className="flex items-center gap-0.5">
          <span className="price rounded bg-[color:var(--color-shop-price-was)] px-1.5 py-0.5 text-[11.5px] leading-tight text-white tabular-nums">
            {part}
          </span>
          {index < 2 && (
            <span
              aria-hidden
              className="text-[11.5px] font-bold text-[color:var(--color-shop-price-was)]"
            >
              :
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
