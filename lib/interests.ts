"use client";

/**
 * What this shopper seems to like, by category, kept in their own browser.
 *
 * Every product page they open and every item they add to the cart nudges the
 * score of that product's categories up — an add counts for much more than a
 * look. Older signals fade a little with each new one, so the feed follows what
 * they are shopping for now rather than what they looked at a month ago.
 *
 * Nothing leaves the device: it is a small map in localStorage, read by the
 * homepage feed (`lib/arrange-feed.ts`) to decide which categories to show
 * more of. Every read and write is guarded — private browsing, blocked storage
 * or a full quota simply mean no personalisation, never a broken page.
 */

const STORAGE_KEY = "kandi-interests-v1";
/** How much each older signal is worth after a new one arrives. */
const DECAY = 0.93;
/** Scores below this are dropped, so the map cannot grow without end. */
const FLOOR = 0.05;
/** Never more than this many categories remembered. */
const MAX_CATEGORIES = 40;

export type Interests = Record<string, number>;

/** How strongly each kind of action says "I want this". */
export const INTEREST = {
  view: 1,
  wishlist: 2,
  cart: 4,
} as const;

export function readInterests(): Interests {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Interests) : {};
  } catch {
    return {};
  }
}

/**
 * Record one signal for a product. Accepts anything with categories, so it can
 * be called with a full `Product` or a lighter shape from a tile.
 */
export function recordInterest(
  product: { categories?: { slug: string }[] } | null | undefined,
  weight: number
): void {
  const slugs = (product?.categories ?? []).map((category) => category.slug).filter(Boolean);
  if (slugs.length === 0) return;

  try {
    const current = readInterests();
    const next: Interests = {};
    for (const [slug, score] of Object.entries(current)) {
      const faded = score * DECAY;
      if (faded >= FLOOR) next[slug] = faded;
    }
    for (const slug of slugs) {
      next[slug] = (next[slug] ?? 0) + weight;
    }
    const kept = Object.entries(next)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CATEGORIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Storage unavailable: the shop works the same, just unpersonalised.
  }
}

/** The shopper's strongest categories, best first. */
export function topInterests(interests: Interests, count: number): string[] {
  return Object.entries(interests)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([slug]) => slug);
}
