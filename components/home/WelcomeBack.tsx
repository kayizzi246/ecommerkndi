"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { formatPrice } from "@/lib/currency";
import type { CurrentPrice } from "@/lib/woocommerce";

/** Where the last price check is kept in the browser, and for how long. */
const PRICE_CACHE_KEY = "kandi-welcome-prices-v1";
const PRICE_CACHE_MS = 6 * 60 * 60 * 1000;
type PriceCache = { ids: string; at: number; prices: CurrentPrice[] };

/**
 * The returning shopper's panel, under the homepage banner.
 *
 * Two honest reasons to come back, both read from the shopper's own browser:
 * the basket they left (with a Checkout button), and the products they looked
 * at — checked against today's prices, so anything that has dropped since they
 * saw it, or gone on sale, leads the row with the saving spelled out. Nothing
 * here is invented: no price is shown as dropped unless it really is lower
 * than the one recorded when they viewed it.
 *
 * Renders nothing for a first-time visitor, and nothing on the server: the
 * data lives in localStorage, so it appears after mount with a fade-in.
 */
export default function WelcomeBack() {
  const { items: viewed } = useRecentlyViewed();
  const { count, subtotal } = useCart();
  const [mounted, setMounted] = useState(false);
  const [prices, setPrices] = useState<Map<number, CurrentPrice> | null>(null);

  const ids = viewed.slice(0, 10).map((item) => item.productId);
  const idKey = ids.join(",");

  useEffect(() => {
    // localStorage is only readable in the browser, after hydration.
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!idKey) return;
    let cancelled = false;
    const show = (list: CurrentPrice[]) => {
      if (!cancelled) setPrices(new Map(list.map((p) => [p.id, p])));
    };

    /* Each visitor's list of viewed products is different, so the CDN cannot
       share answers between them and every visit was a WordPress lookup. The
       answer is kept in this browser for six hours instead, and only asked
       again when that time has passed or the viewed list has changed. */
    try {
      const saved = JSON.parse(localStorage.getItem(PRICE_CACHE_KEY) ?? "null") as PriceCache | null;
      if (saved && saved.ids === idKey && Date.now() - saved.at < PRICE_CACHE_MS) {
        const frame = requestAnimationFrame(() => show(saved.prices));
        return () => {
          cancelled = true;
          cancelAnimationFrame(frame);
        };
      }
    } catch {
      // Storage unavailable (private mode): fall through to a fresh lookup.
    }

    fetch(`/api/products/prices?ids=${idKey}`)
      .then((response) => (response.ok ? response.json() : { prices: [] }))
      .then((payload: { prices?: CurrentPrice[] }) => {
        const list = payload.prices ?? [];
        show(list);
        try {
          localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({ ids: idKey, at: Date.now(), prices: list }));
        } catch {
          // Storage full or blocked; the panel still works, it just asks again.
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idKey]);

  if (!mounted || (viewed.length === 0 && count === 0)) return null;

  const tiles = viewed
    .slice(0, 10)
    .map((item) => {
      const now = prices?.get(item.productId);
      const price = now?.price || item.price;
      const dropBy = now && now.price > 0 && now.price < item.price ? item.price - now.price : 0;
      const onSale = Boolean(now?.on_sale && now.regular_price > now.price);
      const was = dropBy > 0 ? item.price : onSale ? now!.regular_price : 0;
      return { item, price, dropBy, onSale, was, gone: now ? !now.in_stock : false };
    })
    .filter((tile) => !tile.gone)
    // Real news first: price drops, then sales, then the rest as they were.
    .sort((a, b) => Number(b.dropBy > 0) - Number(a.dropBy > 0) || Number(b.onSale) - Number(a.onSale));

  // "Cheaper now" only for a real drop since they looked; a product that was
  // already reduced when they saw it is "on sale", not cheaper.
  /** Enough products to loop without the same one showing twice on screen. */
  const marquee = tiles.length >= 5;

  const drops = tiles.filter((tile) => tile.dropBy > 0).length;
  const sales = tiles.filter((tile) => tile.dropBy === 0 && tile.onSale).length;
  const news =
    drops > 0
      ? drops === 1
        ? "1 item you viewed is cheaper now"
        : `${drops} items you viewed are cheaper now`
      : sales > 0
        ? sales === 1
          ? "1 item you viewed is on sale"
          : `${sales} items you viewed are on sale`
        : null;

  return (
    <section className="hx-panel wb" aria-labelledby="wb-title">
      {count > 0 && (
        <div className="wb-cart">
          <span className="wb-cart-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h2.2l2 10.5h11.1L20 9H6.2" />
              <circle cx="9" cy="20" r="1.2" />
              <circle cx="17.5" cy="20" r="1.2" />
            </svg>
          </span>
          <p className="wb-cart-text">
            <strong>
              You left {count} {count === 1 ? "item" : "items"} in your cart
            </strong>
            <span>{formatPrice(subtotal)} · finish your order in a minute</span>
          </p>
          <Link href="/cart" className="wb-cart-link">
            View cart
          </Link>
          <Link href="/checkout" className="wb-cart-cta">
            Checkout
          </Link>
        </div>
      )}

      {tiles.length > 0 && (
        <>
          <div className="hx-panel-head">
            <h2 id="wb-title" className="hx-panel-title">
              {news ? (
                <>
                  Welcome back! <span className="wb-hot">{news}</span>
                </>
              ) : (
                "Welcome back! Pick up where you left off"
              )}
            </h2>
          </div>
          {/* ---- A carousel that keeps moving ----
               The row is rendered twice end to end and slid left by exactly one
               copy's width, so the loop never shows a seam. It pauses under the
               pointer or a finger (see .wb-marquee in black-november.css) so a
               product can be tapped, and the copy is hidden from screen readers
               and the keyboard. Too few items to loop, and it is a plain row. */}
          <div className={`wb-viewport ${marquee ? "wb-marquee" : ""}`}>
            <ul className="hx-deals-row no-scrollbar wb-row" style={marquee ? { animationDuration: `${tiles.length * 3.5}s` } : undefined}>
              {(marquee ? [...tiles, ...tiles] : tiles).map(({ item, price, dropBy, onSale, was }, index) => {
                const copy = index >= tiles.length;
                return (
                  <li key={`${item.productId}-${copy ? "b" : "a"}`} aria-hidden={copy || undefined}>
                    <Link
                      href={`/products/${item.slug || item.productId}`}
                      className="hx-deal"
                      tabIndex={copy ? -1 : undefined}
                    >
                      <span className="hx-deal-photo">
                        {item.image && (
                          <Image src={item.image} alt="" fill sizes="(max-width: 640px) 36vw, 180px" className="object-cover" />
                        )}
                        {dropBy > 0 ? (
                          <span className="wb-badge">Price drop</span>
                        ) : onSale ? (
                          <span className="wb-badge">On sale</span>
                        ) : null}
                      </span>
                      <span className={`hx-deal-price ${dropBy > 0 || onSale ? "" : "wb-plain"}`}>{formatPrice(price)}</span>
                      {was > 0 ? (
                        <s className="hx-deal-was">{formatPrice(was)}</s>
                      ) : (
                        <span className="hx-deal-was">&nbsp;</span>
                      )}
                      {dropBy > 0 && <span className="wb-save">{formatPrice(dropBy)} less than you saw</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
