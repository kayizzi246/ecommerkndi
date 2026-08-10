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

/**
 * Category names indented to show the department tree, so "Running Shoes" reads
 * as living under "Shoes" in a flat <select> where nesting cannot be drawn.
 */
export function categoryOptions(categories: PickableCategory[]) {
  const children = new Map<number, PickableCategory[]>();
  for (const category of categories) {
    const parent = category.parent ?? 0;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(category);
  }

  const options: { value: string; label: string }[] = [];

  const walk = (parentId: number, depth: number) => {
    for (const category of children.get(parentId) ?? []) {
      options.push({
        value: category.name,
        label: `${"— ".repeat(depth)}${category.name}`,
      });
      walk(category.id, depth + 1);
    }
  };

  walk(0, 0);

  // Any category whose parent is missing from the list would otherwise vanish;
  // promote it rather than silently dropping it from the picker.
  const seen = new Set(options.map((option) => option.value));
  for (const category of categories) {
    if (!seen.has(category.name)) {
      options.push({ value: category.name, label: category.name });
    }
  }

  return options;
}
