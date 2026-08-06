import type { Product } from "@/lib/woocommerce";
import { discountPercent } from "@/lib/currency";

/**
 * Applies the `sort` query parameter to a page of products. The WordPress API
 * only orders by date, so the listing pages refine the current page locally —
 * shared here so every listing sorts identically.
 */
export function sortProducts(products: Product[], sort?: string): Product[] {
  const sorted = [...products];

  switch (sort) {
    case "price_asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price_desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "discount":
      return sorted.sort(
        (a, b) =>
          discountPercent(b.regular_price, b.price) - discountPercent(a.regular_price, a.price)
      );
    case "newest":
      return sorted.sort((a, b) => {
        if (!a.date_created) return 1;
        if (!b.date_created) return -1;
        return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
      });
    default:
      return sorted;
  }
}
