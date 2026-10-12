"use client";

import { useEffect, useState } from "react";

const BUY_NOW = ["Buy now", "Gula kati"];
/** "Teeka mu kibbo": put it in the basket. */
const ADD_TO_CART = ["Add to cart", "Teeka mu kibbo"];

/**
 * "Buy now", continuously swapping with the Luganda "Gula kati".
 *
 * Every style is inline and the swap is a timer, so it does not depend on the
 * global stylesheet: an earlier CSS-keyframe version showed both words side by
 * side ("Buy nowGula kati") whenever that stylesheet was stale. Both words sit
 * in one grid cell, so the button keeps the width of the longer one and nothing
 * beside it moves. Under reduced motion it stays on "Buy now". Screen readers
 * get one plain "Buy now".
 */
export default function BuyNowLabel({ className = "" }: { className?: string }) {
  return <SwapLabel words={BUY_NOW} className={className} />;
}

/** "Add to cart", swapping with the Luganda "Teeka mu kibbo" the same way. */
export function AddToCartLabel({ className = "" }: { className?: string }) {
  return <SwapLabel words={ADD_TO_CART} className={className} />;
}

function SwapLabel({ words, className }: { words: string[]; className: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % words.length), 2000);
    return () => window.clearInterval(timer);
  }, [words.length]);

  return (
    <span
      className={className}
      style={{ display: "inline-grid", justifyItems: "center", verticalAlign: "middle", position: "relative" }}
    >
      <span className="sr-only">{words[0]}</span>
      {words.map((word, i) => {
        const showing = i === index;
        return (
          <span
            key={word}
            aria-hidden
            style={{
              gridArea: "1 / 1",
              whiteSpace: "nowrap",
              opacity: showing ? 1 : 0,
              transform: showing ? "scale(1)" : "scale(0.85)",
              transition: "opacity 350ms ease, transform 350ms ease",
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}
