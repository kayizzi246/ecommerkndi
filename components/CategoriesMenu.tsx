"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import type { CategoryNode, ProductCategory } from "@/lib/woocommerce";

/**
 * The Categories mega-menu.
 *
 * A department rail on the left; hovering one fills the right panel with its
 * sub-categories as circular tiles. That shape exists because a marketplace
 * taxonomy is two levels deep and wide at both — a stack of collapsible rows
 * makes finding a sub-category a hunt, whereas this shows a whole department at
 * a glance and switches on hover with no click at all.
 *
 * Everything comes from the WooCommerce `product_cat` tree. Tiles use each
 * category's own WooCommerce image where one is set (Products → Categories →
 * Thumbnail); where none is, the circle carries the category's initial rather
 * than a broken image.
 *
 * A department with no children shows its own tile, so the panel is never empty
 * and the department is still one click away.
 */
export default function CategoriesMenu({ departments }: { departments: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
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

  if (departments.length === 0) return null;

  const active = departments.find((d) => d.id === activeId) ?? departments[0];
  const tiles: ProductCategory[] =
    active.children.length > 0 ? active.children : [active];

  return (
    <div
      className="relative"
      onPointerEnter={show}
      onPointerLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[14.5px] font-medium transition-colors ${
          open ? "text-shop-flame" : "text-shop-body hover:text-shop-flame"
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
          <div className="flex max-h-[70vh] w-[860px] max-w-[92vw] overflow-hidden rounded-lg border border-shop-line bg-white">
            {/* ---- Department rail ---- */}
            <ul className="w-[228px] shrink-0 overflow-y-auto border-r border-shop-line py-2">
              {departments.map((department) => {
                const isActive = department.id === active.id;
                return (
                  <li key={department.id}>
                    <Link
                      href={`/category/${department.slug}`}
                      onPointerEnter={() => setActiveId(department.id)}
                      onFocus={() => setActiveId(department.id)}
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between gap-2 px-4 py-2.5 text-[14px] transition-colors ${
                        isActive
                          ? "bg-shop-primary-soft font-semibold text-shop-flame"
                          : "text-shop-body hover:bg-shop-primary-soft hover:text-shop-flame"
                      }`}
                    >
                      <span className="min-w-0 truncate">{department.name}</span>
                      <svg aria-hidden className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                      </svg>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* ---- Sub-category tiles ---- */}
            <div className="min-w-0 flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-5 gap-x-4 gap-y-5">
                {tiles.map((tile) => (
                  <Link
                    key={tile.id}
                    href={`/category/${tile.slug}`}
                    onClick={() => setOpen(false)}
                    className="group flex flex-col items-center gap-2 text-center"
                  >
                    <span className="relative flex h-[86px] w-[86px] items-center justify-center overflow-hidden rounded-full bg-shop-hairline transition-transform duration-200 group-hover:scale-105">
                      {tile.image ? (
                        <Image
                          src={tile.image}
                          alt=""
                          fill
                          sizes="86px"
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <span className="font-heading text-[26px] text-shop-flame">
                          {tile.name.trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-[12.5px] leading-tight text-shop-body transition-colors group-hover:text-shop-flame">
                      {tile.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
