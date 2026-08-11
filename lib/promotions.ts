import type { Product } from "@/lib/woocommerce";
import { discountPercent } from "@/lib/currency";
import type { Promotion } from "@/components/home/PromotionsRail";

/** A product counts as new for this long after it was created. */
const NEW_WINDOW_DAYS = 30;

/**
 * Promotions worked out from the catalogue, for a shop that has not written any.
 *
 * Every card here is a statement of fact the shop can be held to: the discount
 * is the largest one genuinely on sale, the count of new arrivals is counted,
 * the free-delivery threshold is the one checkout enforces. Nothing is a
 * seasonal campaign, because the code has no way of knowing whether the shop is
 * running one — inventing "Christmas Sale" would be a claim nobody made.
 *
 * The moment a real campaign is written in wp-admin, these give way to it.
 */
export function derivePromotions(
  onSale: Product[],
  latest: Product[],
  freeDeliveryFrom: number,
  formatPrice: (amount: number) => string
): Promotion[] {
  const promotions: Promotion[] = [];

  const deepest = onSale.reduce(
    (best, product) => Math.max(best, discountPercent(product.regular_price, product.price)),
    0
  );

  if (deepest > 0) {
    promotions.push({
      badge: `${deepest}% OFF`,
      headline: onSale.length > 3 ? "Today's biggest markdowns" : "On sale right now",
      note:
        onSale.length > 1
          ? `${onSale.length} products reduced — while stocks last.`
          : "One product reduced today.",
      url: "/sale",
    });
  }

  const cutoff = Date.now() - NEW_WINDOW_DAYS * 86_400_000;
  const fresh = latest.filter(
    (product) => product.date_created && new Date(product.date_created).getTime() > cutoff
  );

  if (fresh.length > 0) {
    promotions.push({
      badge: "New in",
      headline: "Just landed",
      note: `${fresh.length} new ${fresh.length === 1 ? "product" : "products"} this month.`,
      url: "/search?sort=newest",
    });
  }

  // Ordered by units actually sold, so "popular" means popular.
  const proven = latest.filter((product) => product.total_sales > 0);
  if (proven.length >= 3) {
    promotions.push({
      badge: "Best sellers",
      headline: "What Uganda is buying",
      note: "The products shoppers here come back for.",
      url: "/search?sort=popular",
    });
  }

  promotions.push({
    badge: "Free delivery",
    headline: `Spend ${formatPrice(freeDeliveryFrom)}, pay nothing to deliver`,
    note: "Anywhere we deliver, however far.",
    url: "/search",
  });

  return promotions;
}
