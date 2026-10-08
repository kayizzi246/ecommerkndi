import type { Product } from "@/lib/woocommerce";
import type { Interests } from "@/lib/interests";

/**
 * Order a batch of products so the grid feels mixed and personal.
 *
 * Two jobs at once:
 *
 *   1. SCATTER. Products arrive from WooCommerce in runs — five phone cases,
 *      then six pairs of shoes — and a run reads as one product repeated. The
 *      batch is split by category and dealt out like cards, so neighbours are
 *      different kinds of thing and the eye keeps finding something new.
 *
 *   2. PERSONALISE. Categories the shopper has viewed or added to the cart
 *      (`lib/interests.ts`) are dealt more often, so their kind of product
 *      turns up more — but still interleaved with everything else, so the feed
 *      never collapses into one category.
 *
 * Deterministic: the same batch and the same interests always give the same
 * order. With no interests (the server, a first visit) it is pure scatter,
 * which is what lets the server and the browser render the same first page.
 *
 * `previous` is the tail of what is already on screen, so a new batch does not
 * start with the same category the last one ended on.
 */
export function arrangeProducts(
  products: Product[],
  interests: Interests | null,
  previous: Product[] = []
): Product[] {
  if (products.length < 3) return products;

  const groupOf = (product: Product) => product.categories?.[0]?.slug ?? "none";

  // Interest of a product = its strongest category, scaled to 0..1.
  const strongest = Math.max(0, ...Object.values(interests ?? {}));
  const interestOf = (product: Product) => {
    if (!interests || strongest === 0) return 0;
    let best = 0;
    for (const category of product.categories ?? []) {
      best = Math.max(best, interests[category.slug] ?? 0);
    }
    return best / strongest;
  };

  // Buckets in order of first appearance, each keeping WooCommerce's order
  // inside it (newest/featured first) — only the interleaving changes.
  const buckets = new Map<string, { items: Product[]; weight: number; taken: number }>();
  for (const product of products) {
    const key = groupOf(product);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { items: [], weight: 0, taken: 0 };
      buckets.set(key, bucket);
    }
    bucket.items.push(product);
    bucket.weight = Math.max(bucket.weight, interestOf(product));
  }

  const result: Product[] = [];
  const recent = previous.slice(-2).map(groupOf);

  while (result.length < products.length) {
    let chosenKey: string | null = null;
    let chosenScore = -Infinity;
    let fallbackKey: string | null = null;
    let fallbackScore = -Infinity;

    for (const [key, bucket] of buckets) {
      if (bucket.items.length === 0) continue;
      // A liked category is dealt up to 4x as often as an unliked one.
      const score = (1 + 3 * bucket.weight) / (1 + bucket.taken);
      if (score > fallbackScore) {
        fallbackScore = score;
        fallbackKey = key;
      }
      // Skip the categories just placed, so the same kind never sits side by
      // side (or directly above itself on a two-column phone grid).
      if (recent.includes(key)) continue;
      if (score > chosenScore) {
        chosenScore = score;
        chosenKey = key;
      }
    }

    const key = chosenKey ?? fallbackKey;
    if (key === null) break;
    const bucket = buckets.get(key)!;
    result.push(bucket.items.shift()!);
    bucket.taken += 1;
    recent.push(key);
    if (recent.length > 2) recent.shift();
  }

  return result;
}
