"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Counts down to the next midnight (local time). */
export default function FlashSaleCountdown() {
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

  if (remaining === null) {
    return <span className="font-mono font-semibold">--h : --m : --s</span>;
  }

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <span className="font-mono font-semibold">
      {pad(hours)}h : {pad(minutes)}m : {pad(seconds)}s
    </span>
  );
}
