"use client";

import { useEffect, useState } from "react";

export type PickableCategory = {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
};

/**
 * The shop's real WooCommerce categories, for browser-side pickers.
 *
 * Every screen where somebody chooses a category — seller onboarding, the new
 * listing form, the owner's product editor — reads from here, so a seller can
 * only file a product under a department a shopper can actually browse to.
 *
 * `loading` is exposed separately from an empty list because the two mean very
 * different things to a form: one is "wait", the other is "this shop has no
 * categories yet, let them type one".
 */
export function useCategories() {
  const [categories, setCategories] = useState<PickableCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/categories");
        const payload = (await response.json()) as { categories?: PickableCategory[] };
        if (!cancelled) setCategories(payload.categories ?? []);
      } catch {
        // A picker with no list falls back to free text, which is better than
        // blocking the form on a network hiccup.
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading };
}

export type CategoryBranch = PickableCategory & { children: CategoryBranch[] };

/**
 * The flat category list as the tree it actually is.
 *
 * This replaces `categoryOptions`, which flattened the same data back down into
 * one <select> and drew the nesting with em-dash prefixes — "— — Necklaces".
 * That works while a shop has two departments. This one has ten, several three
 * levels deep, and the result was a forty-row dropdown where a seller had to
 * count dashes to work out whether the "Shoes" they were looking at was the
 * one under Men or the one under Women. Two identical labels at two different
 * depths is not a picker, it is a quiz.
 *
 * A tree lets the picker ask one question at a time — see
 * `components/seller/CategoryPicker`.
 */
export function categoryTree(categories: PickableCategory[]): CategoryBranch[] {
  const byId = new Map<number, CategoryBranch>();
  for (const category of categories) {
    byId.set(category.id, { ...category, children: [] });
  }

  const roots: CategoryBranch[] = [];
  for (const branch of byId.values()) {
    const parent = branch.parent ? byId.get(branch.parent) : undefined;
    // A category whose parent is missing from the list would otherwise vanish
    // from the picker entirely; promote it to a department rather than drop it.
    if (parent) parent.children.push(branch);
    else roots.push(branch);
  }

  return roots;
}

/**
 * The chain of categories from a department down to the one with this slug, so
 * a form holding `necklaces-jewelry-women` can reopen on Women › Jewelry ›
 * Necklaces rather than on an empty picker with the answer three levels down.
 *
 * ---- Slug, not name, and this is not a detail ----
 *
 * This shop has 64 categories and 17 names that appear in more than one branch.
 * There is a "Shoes" under Men, a "Shoes" under Women and a "Shoes" under Kids;
 * "Necklaces" exists three times over. A name does not identify a category here
 * — it identifies up to three of them — so a picker that resolves by name has
 * to guess, and a first-match-wins guess sends a women's necklace to Kids.
 *
 * Slugs are unique: WordPress enforces it, and all 64 in this shop are distinct
 * (`necklaces`, `necklaces-jewelry-women`, `necklaces-jewelry-kids`). So the
 * slug is what the picker holds and what the form submits.
 */
export function categoryPath(tree: CategoryBranch[], slug: string): CategoryBranch[] {
  if (!slug) return [];

  const walk = (branches: CategoryBranch[], trail: CategoryBranch[]): CategoryBranch[] | null => {
    for (const branch of branches) {
      const here = [...trail, branch];
      if (branch.slug === slug) return here;
      const deeper = walk(branch.children, here);
      if (deeper) return deeper;
    }
    return null;
  };

  return walk(tree, []) ?? [];
}
