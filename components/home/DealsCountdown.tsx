"use client";

import { useEffect, useState } from "react";

const HOUR = 60 * 60 * 1000;

/**
 * Time left in Black November, counted to midnight on 30 November in Kampala
 * (UTC+3). A real deadline: outside November it shows nothing.
 */
export default function DealsCountdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    // The first reading comes after hydration, so server and browser agree.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (now === null) return null;

  // The calendar in Kampala, three hours ahead of UTC.
  const kampala = new Date(now + 3 * HOUR);
  if (kampala.getUTCMonth() !== 10) return null;
  const end = Date.UTC(kampala.getUTCFullYear(), 11, 1) - 3 * HOUR;
  const left = Math.floor((end - now) / 1000);
  if (left <= 0) return null;

  const days = Math.floor(left / 86400);
  const clock = [Math.floor((left % 86400) / 3600), Math.floor((left % 3600) / 60), left % 60];

  return (
    <p className="bnd-timer" aria-label={`Ends in ${days} days and ${clock[0]} hours`}>
      <span className="bnd-timer-label">Ends in</span>
      {days > 0 && <span className="bnd-timer-days">{days}d</span>}
      {clock.map((value, index) => (
        <span key={index} className="bnd-timer-box">
          {String(value).padStart(2, "0")}
        </span>
      ))}
    </p>
  );
}
