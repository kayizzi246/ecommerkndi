import type { CategoryNode, ProductCategory } from "@/lib/woocommerce";

/**
 * "Men's Clothing" → ["mens", "clothing"]; "Home & Living" → ["home", "living"].
 *
 * The apostrophe is dropped rather than split on, so a possessive stays one
 * word and can be compared to its singular below.
 */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Whether one word of a category name names the same thing as the needle,
 * allowing for the plural and the possessive a shop actually types.
 *
 * Whole words only, and this is the rule the whole matcher rests on: "women"
 * contains "men", so anything looser than this sends every shopper who clicks
 * Men into the women's department. A substring match here would be a bug that
 * looks like a working link.
 */
function sameWord(word: string, needle: string): boolean {
  return word === needle || word === `${needle}s` || `${word}s` === needle;
}

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
 * ## What was wrong
 *
 * It matched a whole name, an exact slug, or a slug beginning `needle-`. Every
 * one of those misses the way people actually name departments in wp-admin: a
 * category called **Men's Clothing** has the slug `mens-clothing`, which is not
 * `men`, does not start with `men-`, and whose name is not "men". So the header
 * link fell through to `/search?q=men` and the homepage rail found no category
 * at all and rendered nothing. The same held for Women, Kids, Beauty and
 * Electronics — the whole department nav was live only for a shop that had
 * named its categories with exactly one word each.
 *
 * ## The rule now
 *
 * Every category is scored and the best is taken, rather than the first thing
 * that happens to match:
 *
 *   1. the name or the slug *is* the word — "Men" beats everything;
 *   2. a word of the slug is the word — `mens-clothing`, `shoes-formal`;
 *   3. a word of the name is the word — "Men's Clothing", "Home & Living".
 *
 * Ties break towards a category that has stock, then towards a top-level
 * department over a child, then towards the shorter name — so "Shoes" wins over
 * "Formal Shoes", and a department wins over its own sub-category.
 *
 * Returns null when the shop has no such category, which is a real answer: the
 * caller then either links to a search instead or drops the rail entirely.
 */
export function findCategorySlug(
  departments: CategoryNode[],
  needle: string
): string | null {
  const wanted = needle.toLowerCase().trim();
  if (wanted === "") return null;

  let best: { slug: string; rank: number; empty: number; depth: number; size: number } | null =
    null;

  const consider = (candidate: ProductCategory, depth: number) => {
    const name = candidate.name.toLowerCase().trim();
    const slug = candidate.slug.toLowerCase();

    let rank: number;
    if (name === wanted || slug === wanted) {
      rank = 0;
    } else if (words(slug).some((word) => sameWord(word, wanted))) {
      rank = 1;
    } else if (words(name).some((word) => sameWord(word, wanted))) {
      rank = 2;
    } else {
      return;
    }

    const scored = {
      slug: candidate.slug,
      rank,
      // A department with nothing in it is a worse answer than one with stock,
      // but still a better answer than a search page — so it ranks last rather
      // than being discarded.
      empty: (candidate.count ?? 0) > 0 ? 0 : 1,
      depth,
      size: words(name).length,
    };

    if (
      !best ||
      scored.rank < best.rank ||
      (scored.rank === best.rank &&
        (scored.empty < best.empty ||
          (scored.empty === best.empty &&
            (scored.depth < best.depth ||
              (scored.depth === best.depth && scored.size < best.size)))))
    ) {
      best = scored;
    }
  };

  for (const department of departments) {
    consider(department, 0);
    // Children are searched too, because a small shop often files Men under
    // Clothing rather than at the top level.
    for (const child of department.children) consider(child, 1);
  }

  return best ? (best as { slug: string }).slug : null;
}

/**
 * The same match as {@link findCategorySlug}, but returning the whole department
 * node rather than just a slug.
 *
 * The mega menu needs the children, not the address: a dropdown under "Men" is a
 * list of what is inside Men, and that list only exists on the node. Built on
 * the slug matcher rather than beside it so the panel that opens under a nav
 * link and the page that link goes to can never disagree about which category
 * the word "Men" refers to.
 *
 * When the match landed on a child category — a shop that files Men under
 * Clothing — the *parent* is returned, because that is the node with siblings
 * worth listing. Null when the shop has no such category at all, in which case
 * the nav link falls back to a search and simply opens no panel.
 */
export function findDepartment(
  departments: CategoryNode[],
  needle: string
): CategoryNode | null {
  const slug = findCategorySlug(departments, needle);
  if (!slug) return null;

  return (
    departments.find((department) => department.slug === slug) ??
    departments.find((department) =>
      department.children.some((child) => child.slug === slug)
    ) ??
    null
  );
}
