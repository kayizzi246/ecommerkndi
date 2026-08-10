"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Messages to cycle through. Rendered in order, looping. */
  messages: string[];
  className?: string;
  /** Milliseconds each message stays on screen. */
  interval?: number;
};

/**
 * Rotating one-line promise, the animated strip marketplaces run across the
 * top of the page. Each message slides up as the last one leaves.
 *
 * The messages are the store's real promises (free delivery threshold, payment
 * methods, the returns window) — not invented scarcity, which is both
 * dishonest and, for stock claims, illegal to fabricate in most markets.
 *
 * The first render always shows `messages[0]`, so the server and the browser
 * agree and the rotation only starts once the timer is running.
 */
export default function SalesTicker({
  messages,
  className = "",
  interval = 3200,
}: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;

    // Respect a reduced-motion preference: the copy still rotates, it just
    // does not slide.
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % messages.length),
      interval
    );
    return () => clearInterval(timer);
  }, [messages.length, interval]);

  if (messages.length === 0) return null;

  return (
    <span
      className={`relative flex h-5 items-center overflow-hidden ${className}`}
      // The whole strip is decorative repetition of copy that also appears in
      // the footer, so it is announced once rather than on every rotation.
      aria-live="off"
    >
      <span key={index} className="ticker-line block truncate">
        {messages[index]}
      </span>
    </span>
  );
}
