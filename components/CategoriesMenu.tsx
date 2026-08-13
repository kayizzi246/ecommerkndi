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
 * The CSS column count does the layout. Groups are kept whole with
 * `break-inside-avoid`, so a department heading is never stranded at the foot of
 * one column with its children at the top of the next.
 */

/** Children shown per department before the list is cut off. */
const CHILDREN_SHOWN = 6;

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
  //
  // Grouped and bare entries look ragged mixed together — a heading with
  // nothing under it reads as a group whose contents failed to load. So the
  // bare ones are gathered into one list of their own at the end.
  const grouped = departments.filter((department) => department.children.length > 0);
  const loose = departments.filter((department) => department.children.length === 0);

  return (
    <div className="relative" onPointerEnter={show} onPointerLeave={scheduleClose}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        // Bold and inked, matching the curated links it sits beside — this is
        // the entry to the whole department tree and should not be the lightest
        // thing in the row.
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[14.5px] font-bold transition-colors ${
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
          {/* Height follows the content rather than being fixed — a short
              taxonomy gets a short panel instead of a wall of white. */}
          <div className="max-h-[76vh] w-[940px] max-w-[94vw] overflow-y-auto rounded-lg border border-shop-line bg-white p-6 shadow-[0_12px_32px_rgba(23,23,23,0.10)]">
            <div className="columns-4 gap-x-7 [column-fill:balance]">
              {grouped.map((department) => {
                const children = department.children.slice(0, CHILDREN_SHOWN);
                const hidden = department.children.length - children.length;

                return (
                  <div
                    key={department.id}
                    className="mb-5 break-inside-avoid"
                  >
                    <Link
                      href={`/category/${department.slug}`}
                      onClick={() => setOpen(false)}
                      className="block text-[14px] font-semibold text-shop-ink transition-colors hover:text-shop-flame"
                    >
                      {department.name}
                    </Link>

                    {children.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/category/${child.slug}`}
                              onClick={() => setOpen(false)}
                              className="block text-[13px] leading-5 text-shop-muted transition-colors hover:text-shop-flame"
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}

                        {hidden > 0 && (
                          <li>
                            <Link
                              href={`/category/${department.slug}`}
                              onClick={() => setOpen(false)}
                              className="block text-[13px] font-medium leading-5 text-shop-flame hover:underline"
                            >
                              +{hidden} more
                            </Link>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            {loose.length > 0 && (
              <div className={grouped.length > 0 ? "mt-1 border-t border-shop-line pt-5" : ""}>
                {grouped.length > 0 && (
                  <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-shop-faint">
                    More to shop
                  </p>
                )}

                {/* Chips rather than another column of text: these have no
                    hierarchy to express, and a flat list of links under the
                    grouped columns would read as one more department. */}
                <ul className="flex flex-wrap gap-2">
                  {loose.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={`/category/${category.slug}`}
                        onClick={() => setOpen(false)}
                        className="block rounded-full border border-shop-line px-3.5 py-1.5 text-[13px] text-shop-body transition-colors hover:border-shop-primary hover:text-shop-flame"
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
