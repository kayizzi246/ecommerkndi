"use client";

import { useEffect } from "react";

/**
 * Tells the shop that this product page was looked at.
 *
 * Renders nothing. It exists as a component rather than a line inside the
 * product page because the page is a server component — nothing there runs in
 * the browser, and a view is by definition something that happened in one.
 *
 * ## Once per product, per tab
 *
 * `sessionStorage`, not `localStorage`: a shopper who comes back tomorrow is a
 * new view and should count as one, while the same shopper bouncing between a
 * listing and its photographs for ten minutes is not ten views. Session storage
 * expresses exactly that distinction and needs no timestamps to do it.
 *
 * This is a courtesy rather than a control — anybody can clear it — so the
 * route behind it enforces its own ceiling. The point of the guard here is to
 * keep an honest visitor from being counted twice, which is a data-quality
 * problem, not a security one.
 *
 * ## Why it fires after paint, and why nothing waits for it
 *
 * A view is worth recording only if the page was actually shown, so it goes in
 * an effect rather than during render. `keepalive` lets the request outlive the
 * page when somebody taps straight through to another product, which is the
 * exact case a naive `fetch` loses. The result is discarded and every failure
 * is swallowed: the shopper is here to look at a product, and no analytics
 * write is worth a visible error on the way.
 */
export default function ProductViewPing({ productId }: { productId: number }) {
  useEffect(() => {
    if (!Number.isInteger(productId) || productId <= 0) return;

    const key = `kandi-viewed-${productId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private browsing with storage disabled. Counting the view is better
      // than dropping it: the duplicate cost is one extra count for a visitor
      // who reloads, which is a smaller error than losing the visitor entirely.
    }

    void fetch("/api/products/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
      keepalive: true,
    }).catch(() => undefined);
  }, [productId]);

  return null;
}
