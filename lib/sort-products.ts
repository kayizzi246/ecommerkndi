import type { Product } from "@/lib/woocommerce";
import { discountPercent } from "@/lib/currency";

export type ProductFilters = {
  min_price?: string;
  max_price?: string;
  /** "1" restricts to products currently in stock. */
  stock?: string;
  /** "1" restricts to discounted products. */
  sale?: string;
  /** Category slug from the brand facet. */
  brand?: string;
};

/**
 * Applies the filter query parameters to a page of products.
 *
 * Like {@link sortProducts}, this refines the page the API returned rather
 * than the whole catalogue — the WordPress endpoint only filters by category,
 * search, on_sale and featured, so price, stock and brand are resolved here.
 */
export function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  const min = Number(filters.min_price);
  const max = Number(filters.max_price);

  return products.filter((product) => {
    if (Number.isFinite(min) && filters.min_price && product.price < min) return false;
    if (Number.isFinite(max) && filters.max_price && product.price > max) return false;
    if (filters.stock === "1" && product.stock_status !== "instock") return false;
    if (filters.sale === "1" && !product.on_sale) return false;
    if (filters.brand && !product.categories.some((c) => c.slug === filters.brand)) {
      return false;
    }
    return true;
  });
}

/** The brand facet, counted from the products actually on the page. */
export function brandFacets(products: Product[]): { slug: string; name: string; count: number }[] {
  const counts = new Map<string, { slug: string; name: string; count: number }>();

  for (const product of products) {
    for (const category of product.categories) {
      const existing = counts.get(category.slug);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(category.slug, { slug: category.slug, name: category.name, count: 1 });
      }
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

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
