import type { CategoryNode } from "@/lib/woocommerce";

/**
 * Resolves a plain word — "men", "kids" — to a real WooCommerce category slug.
 *
 * The shop's nav is written by hand rather than generated from the category
 * tree, because that tree is whatever the catalogue happens to contain. But the
 * hand-written labels still have to point at something real, and more than one
 * screen needs to make that connection: the header nav links to the department,
 * and the homepage fills a product rail from it. Both must agree on which
 * category "Men" is, or a shopper clicking through from the rail lands somewhere
 * other than the products they were just shown.
 *
 * Matching rules, in the order they matter:
 *   • names are compared whole, so "Men" cannot match "Women";
 *   • slugs may carry a suffix, so "men" matches `mens-shoes`;
 *   • children are searched as well as departments, because a small shop often
 *     files Men under Clothing rather than at the top level.
 *
 * Returns null when the shop has no such category, which is a real answer: the
 * caller then either links to a search instead or drops the rail entirely.
 */
export function findCategorySlug(
  departments: CategoryNode[],
  needle: string
): string | null {
  const wanted = needle.toLowerCase();

  for (const department of departments) {
    for (const candidate of [department, ...department.children]) {
      const name = candidate.name.toLowerCase();
      const slug = candidate.slug.toLowerCase();
      if (name === wanted || slug === wanted || slug.startsWith(`${wanted}-`)) {
        return candidate.slug;
      }
    }
  }

  return null;
}
