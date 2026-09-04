"use client";

import { useMemo, useState } from "react";
import {
  categoryPath,
  categoryTree,
  useCategories,
  type CategoryBranch,
} from "@/lib/use-categories";

/**
 * Where a listing gets filed, asked one level at a time.
 *
 * ---- Why this is not a <select> ----
 *
 * It was one: every category in the shop in a single dropdown, nesting drawn
 * with em-dash prefixes — "Women", "— Jewelry", "— — Necklaces". That is a fine
 * answer for a shop with two departments and it stopped being one here. The
 * list runs to forty-odd rows across three levels, and several names repeat
 * across branches: there is a "Shoes" under Men, a "Shoes" under Women and a
 * "Shoes" under Kids, and in a flat list they are three identical words
 * distinguished only by how many dashes sit in front of them and how far the
 * seller has scrolled. Sellers were filing women's sandals under Men.
 *
 * Asking one question at a time removes the problem rather than labelling it.
 * Pick Women, and the only sub-departments on screen are Women's. There is no
 * ambiguous "Shoes" to pick, because the wrong ones are not there.
 *
 * ---- Stopping early is allowed ----
 *
 * Every level past the first is optional, and the first is optional too — a
 * listing may go in "Women" and nothing finer. This matters because the
 * alternative is sellers picking a wrong sub-department to satisfy a form,
 * which is worse for a shopper than a product filed one level up. The deepest
 * chip a seller has picked is the value; the trail underneath says what that
 * means in words.
 */
export default function CategoryPicker({
  value,
  onChange,
  disabled = false,
}: {
  /**
   * The category SLUG, which is what the form submits.
   *
   * Not the name: this shop has 17 category names that appear in more than one
   * branch — three "Shoes", three "Necklaces" — so a name does not identify a
   * category. See the note on `categoryPath`.
   */
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
}) {
  const { categories, loading } = useCategories();
  const tree = useMemo(() => categoryTree(categories), [categories]);

  /**
   * The chips the seller has clicked, deepest last.
   *
   * Held here rather than derived from `value` on every render, because the two
   * genuinely differ: a seller who has picked Women and nothing else has a path
   * of one and a value of `women`, and re-deriving would work — but a seller who
   * has picked Women and then clicked it again to back out has a path of zero
   * and a value of "", which is indistinguishable from "nothing chosen yet" once
   * it has been flattened to a single slug.
   */
  const [path, setPath] = useState<CategoryBranch[]>([]);

  /**
   * Adopt an incoming value the picker did not set itself — a form reopened on
   * a saved listing, or a draft restored. Done during render rather than in an
   * effect, which is React's own answer to state that has to follow a prop: an
   * effect would paint the empty picker first and correct it a frame later.
   */
  const [syncedFrom, setSyncedFrom] = useState(value);
  if (value !== syncedFrom) {
    setSyncedFrom(value);
    const chosen = path[path.length - 1]?.slug ?? "";
    if (value !== chosen) setPath(categoryPath(tree, value));
  }

  /**
   * One row of chips per level: the departments, then the children of whatever
   * is chosen at each level above. A level with no children adds no row, which
   * is what stops a two-level branch drawing an empty third question.
   */
  const levels: CategoryBranch[][] = [tree];
  for (const branch of path) {
    if (branch.children.length > 0) levels.push(branch.children);
  }

  const choose = (branch: CategoryBranch, depth: number) => {
    // Clicking the chip that is already on at this level backs out of it, and
    // takes everything below it with it. Without this the only way out of a
    // wrong third-level pick is to reload the form.
    const next =
      path[depth]?.id === branch.id ? path.slice(0, depth) : [...path.slice(0, depth), branch];

    setPath(next);
    const slug = next[next.length - 1]?.slug ?? "";
    setSyncedFrom(slug);
    onChange(slug);
  };

  if (loading) {
    return (
      <p className="rounded-lg border border-shop-line bg-shop-hairline px-3 py-2.5 text-[14px] text-shop-muted">
        Loading departments…
      </p>
    );
  }

  /**
   * No categories at all, and deliberately NOT a free-text box.
   *
   * A text box here would be a lie: the seller endpoint files a listing into an
   * existing department and silently ignores anything that does not resolve to
   * one (see the `term_exists` guard in `kandi-seller-api.php`, which exists
   * because sellers typing "Sportswear" used to mint categories of their own).
   * So a typed category would look accepted, submit cleanly, and file nowhere.
   *
   * `useCategories` swallows a failed fetch and returns an empty list, so this
   * covers both "no departments yet" and "the network dropped". Either way the
   * honest answer is that the form still submits and Kandi files it on review.
   */
  if (tree.length === 0) {
    return (
      <p className="rounded-lg border border-shop-line bg-shop-hairline px-3 py-2.5 text-[14px] text-shop-body">
        No departments to choose from right now — submit the listing and our team
        will file it during approval.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {levels.map((branches, depth) => {
        const parent = depth === 0 ? null : path[depth - 1];
        return (
          <div key={parent?.id ?? "root"}>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-shop-muted">
              {parent ? `In ${parent.name}` : "Department"}
              {depth > 0 && <span className="normal-case tracking-normal"> · optional</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {branches.map((branch) => {
                const active = path[depth]?.id === branch.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => choose(branch, depth)}
                    disabled={disabled}
                    aria-pressed={active}
                    className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                      active
                        ? "border-shop-primary bg-shop-primary-soft text-shop-primary"
                        : "border-shop-line bg-white text-shop-body hover:border-shop-primary hover:text-shop-primary"
                    }`}
                  >
                    {branch.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* The trail. A picker of three chip rows can leave a seller unsure which
          of the three is the answer, so the answer is written out. */}
      <p className="text-[13px] text-shop-body">
        {path.length === 0 ? (
          <span className="text-shop-muted">
            Not filed yet — pick a department so shoppers can browse to it.
          </span>
        ) : (
          <>
            Filed under{" "}
            <span className="font-semibold text-shop-ink">
              {path.map((branch) => branch.name).join(" › ")}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
