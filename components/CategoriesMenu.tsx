"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CategoryNode } from "@/lib/woocommerce";

/**
 * The Categories mega-menu.
 *
 * Every department and its children at once, in columns — not a hover rail with
 * a panel that fills in beside it. The taxonomy here is the reason: it is wide
 * and almost entirely one level deep, so a rail spent a 600px panel displaying
 * the two or three children of whichever department the pointer happened to be
 * over, and left the rest of it blank. Columns show the whole shop in the same
 * space, and finding a category becomes reading rather than hunting.
 *
 * Text, not picture tiles. Most categories have no WooCommerce thumbnail set,
 * and a circle carrying the category's first letter reads as a broken image
 * rather than a design.
 *
 * ---- Why the layout is a packed grid and not `columns-4` ----
 *
 * It was CSS multi-column, with `break-inside-avoid` keeping each department
 * whole. That produces the right words in roughly the right places and gets one
 * thing wrong that the whole panel is judged on: the headings do not line up.
 *
 * A CSS column fills to a balanced HEIGHT, so the second group in column one
 * starts wherever the first group happened to end — which is a different y from
 * the second group in column two, and a different one again in column three. A
 * reader scanning for a department gets a scatter of bold words at a dozen
 * heights instead of a row of headings they can read across. On the reference
 * this shop is measured against every column begins with a heading on the same
 * baseline, each with a rule under it, and groups stack down from there.
 *
 * That shape needs the groups ASSIGNED to columns, not flowed into them, which
 * CSS columns cannot express. {@link packColumns} does the assigning, and each
 * column is then an ordinary flex stack — so every group starts where it was
 * put, and every column starts with a heading at the top of the panel.
 */

/** Children shown per department before the list is cut off. */
const CHILDREN_SHOWN = 10;

/** Columns across the panel. Matches the widest step of the grid below. */
const COLUMN_COUNT = 5;

type Group = {
  id: number | string;
  name: string;
  slug: string;
  children: CategoryNode[];
  /** Total children, before {@link CHILDREN_SHOWN} cut the list. */
  total: number;
};

/**
 * Distributes groups across a fixed number of columns, shortest column first.
 *
 * Greedy rather than optimal, because the thing being balanced is a menu and
 * the cost of a column running two lines long is nothing. What matters is that
 * a department is never split across a column boundary and that the columns end
 * up near enough the same height that the panel does not read as a staircase.
 *
 * Height is counted in ROWS — one for the heading, one per child — rather than
 * in pixels, because the two type sizes are close enough that a row is a fair
 * unit and measuring would mean rendering first.
 */
function packColumns(groups: Group[], columnCount: number): Group[][] {
  const columns: Group[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array<number>(columnCount).fill(0);

  for (const group of groups) {
    let shortest = 0;
    for (let index = 1; index < columnCount; index++) {
      if (heights[index] < heights[shortest]) shortest = index;
    }
    columns[shortest].push(group);
    // +2 rather than +1 for the heading: it carries the rule under it and the
    // gap to the next group, which together are about a row's worth of space.
    heights[shortest] += group.children.length + 2;
  }

  return columns;
}

export default function CategoriesMenu({ departments }: { departments: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A grace period stops the panel flickering shut as the pointer crosses the
  // gap between the button and the panel below it.
  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  // Escape closes it, which is what anyone driving the page from the keyboard
  // will reach for once the panel has swallowed the viewport.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (departments.length === 0) return null;

  // Two shapes arrive in this list. Real departments carry children; alongside
  // them sit categories that were promoted to the top level because their
  // parent was merged away by the de-duplication in `buildCategoryTree`.
  const grouped = departments.filter((department) => department.children.length > 0);
  const loose = departments.filter((department) => department.children.length === 0);

  const groups: Group[] = grouped.map((department) => ({
    id: department.id,
    name: department.name,
    slug: department.slug,
    children: department.children.slice(0, CHILDREN_SHOWN),
    total: department.children.length,
  }));

  /* ---- The bare categories became a group like any other ----

     They were a row of pill-shaped chips under the columns, on the argument
     that they have no hierarchy to express and a flat list would read as one
     more department.

     Reading as one more department is exactly what they should do. A chip row
     is a second visual language inside one panel, and it put a horizontal band
     across the bottom of a layout whose entire logic is vertical — so the eye,
     having learned to read down five columns, hit a row that runs across and
     lost the thread. As a group with a heading they are one more column of
     links, which is what they are: places to shop. */
  if (loose.length > 0) {
    groups.push({
      id: "more",
      name: grouped.length > 0 ? "More to shop" : "Shop by category",
      // The heading is a label rather than a destination when it stands for a
      // set with no parent of its own — /categories is the honest target.
      slug: "",
      children: loose,
      total: loose.length,
    });
  }

  const columns = packColumns(groups, COLUMN_COUNT);

  return (
    <div className="relative" onPointerEnter={show} onPointerLeave={scheduleClose}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        /* Matched to the department links beside it — 13.5px at 400, colour
           rather than weight for the open state. The two are one row and a
           half-pixel of disagreement between them reads as a mistake. */
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[12px] font-normal transition-colors ${
          open ? "text-shop-flame" : "text-shop-ink hover:text-shop-flame"
        }`}
      >
        Categories
        <svg
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 hidden pt-1 lg:block">
          {/* ---- The panel spans the page, not a card's worth of it ----

              It was a 940px rounded box with a border, floating under the
              button. Nine hundred pixels is half of the screens this shop is
              read on, so five columns of links were crammed into the left half
              of the window with the catalogue showing through beside them —
              and the rounded card read as a dropdown belonging to the button
              rather than as the shop's own index.

              It is the width of the page's content column now: `100vw` less
              the nav row's own `md:px-8` gutters, capped at the shell so it
              stops growing where the page stops growing. The two edges then
              line up with everything else on the page, which is what makes it
              read as full-bleed without the panel actually having to escape
              its container — a trick worth preferring to `position: fixed`,
              which would have to be told the header's height and would be
              wrong the moment the masthead changed.

              Square corners and no border for the same reason: the shadow and
              the page edge do the separating, and a hairline box around
              something this wide draws attention to the container instead of
              the contents. */}
          <div className="max-h-[76vh] w-[calc(100vw-4rem)] max-w-[calc(var(--shell)-4rem)] overflow-y-auto rounded-b-lg bg-white px-7 py-7 shadow-[0_16px_40px_rgba(23,23,23,0.13)] ring-1 ring-shop-ink/[0.05]">
            {/* Five columns at every width this panel is shown at, which is
                `lg` and up — the grid MUST agree with `COLUMN_COUNT` or the
                packing is wrong. A responsive `grid-cols-3 xl:grid-cols-5`
                looks reasonable and quietly breaks the whole point of packing:
                three columns cannot hold five, so the fourth and fifth wrap to
                a second row, and their headings sit at a y nothing else shares.

                At the narrow end — a 1024px window — five columns of this panel
                are about 155px each, which a 13px category name fits. Below
                `lg` none of this renders; the drawer serves that width. */}
            <div className="grid grid-cols-5 gap-x-6 xl:gap-x-8">
              {columns.map((column, index) => (
                // Keyed by position, which is stable: the column count is a
                // constant and packing is deterministic for a given tree.
                <div key={index} className="flex flex-col gap-7">
                  {column.map((group) => (
                    <div key={group.id}>
                      {/* ---- The heading, and the rule under it ----

                          The rule is what turns a column of links into a named
                          group. Without it a bold word at the top of a stack is
                          just the first link set heavier, which is how the old
                          panel read — and it is the single clearest thing the
                          reference does that this did not.

                          It runs the width of the column rather than a fixed
                          length, so the five of them draw one line across the
                          top of the panel that the eye reads as a header row. */}
                      {group.slug ? (
                        <Link
                          href={`/category/${group.slug}`}
                          onClick={() => setOpen(false)}
                          className="block border-b border-shop-line pb-2 text-[13px] font-bold tracking-[-0.01em] text-shop-ink transition-colors hover:text-shop-flame"
                        >
                          {group.name}
                        </Link>
                      ) : (
                        <p className="block border-b border-shop-line pb-2 text-[13px] font-bold tracking-[-0.01em] text-shop-ink">
                          {group.name}
                        </p>
                      )}

                      <ul className="mt-2.5 space-y-[7px]">
                        {group.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/category/${child.slug}`}
                              onClick={() => setOpen(false)}
                              className="block text-[13px] leading-5 text-shop-body transition-colors hover:text-shop-flame"
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}

                        {group.total > group.children.length && group.slug && (
                          <li>
                            <Link
                              href={`/category/${group.slug}`}
                              onClick={() => setOpen(false)}
                              className="block text-[13px] font-semibold leading-5 text-shop-flame hover:underline"
                            >
                              View all
                            </Link>
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* One way into the full tree, at the foot of the panel. The old
                layout had no such link at all: a shopper who could not see
                their category in the columns had nowhere left to go. */}
            <div className="mt-7 border-t border-shop-line pt-4">
              <Link
                href="/categories"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-shop-ink transition-colors hover:text-shop-flame"
              >
                All categories
                <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
