"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import type { CategoryNode } from "@/lib/woocommerce";

/**
 * The black department bar plus its full-width dropdown panel.
 *
 * Everything here is driven by the WordPress `product_cat` tree: top-level
 * terms become the bar, their children fill the panel columns. Departments with
 * no children stay plain links, so the panel never opens empty.
 */
export default function MegaMenu({ departments }: { departments: CategoryNode[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A small grace period stops the panel flickering shut as the pointer
  // travels from the bar down into the panel.
  const open = (id: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenId(id);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId(null), 140);
  };

  const active = departments.find((department) => department.id === openId) ?? null;

  return (
    <div onPointerLeave={scheduleClose} className="relative">
      <div className="flex flex-1 items-stretch gap-1 overflow-x-auto no-scrollbar">
        {departments.map((department) => {
          const isOpen = openId === department.id;
          return (
            <Link
              key={department.id}
              href={`/category/${department.slug}`}
              onPointerEnter={() => open(department.id)}
              onFocus={() => open(department.id)}
              className={`relative flex shrink-0 items-center whitespace-nowrap px-3 py-3 text-[13px] transition-colors ${
                isOpen ? "text-bfl-yellow" : "text-white/90 hover:text-bfl-yellow"
              }`}
            >
              {department.name}
              {/* The white pointer BFL draws under the open department */}
              {isOpen && department.children.length > 0 && (
                <span className="absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-b-[7px] border-x-transparent border-b-white" />
              )}
            </Link>
          );
        })}
      </div>

      {active && active.children.length > 0 && (
        <div
          onPointerEnter={() => open(active.id)}
          className="absolute inset-x-0 top-full z-50 hidden border-b border-bfl-line bg-white shadow-lg lg:block"
        >
          <div className="mx-auto grid max-w-[1440px] gap-8 px-8 py-8 lg:grid-cols-[repeat(3,minmax(0,1fr))_420px]">
            {chunk(active.children, 3).map((column, index) => (
              <div key={index}>
                {index === 0 && (
                  <Link
                    href={`/category/${active.slug}`}
                    className="mb-4 block text-[15px] font-bold text-bfl-red hover:underline"
                  >
                    All {active.name}
                  </Link>
                )}
                <ul className="space-y-2.5">
                  {column.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/category/${child.slug}`}
                        className="text-[13px] text-[#333] hover:text-black hover:underline"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Promo tile — the category image when WooCommerce has one */}
            <Link href={`/category/${active.slug}`} className="relative hidden lg:block">
              {active.image ? (
                <div className="relative h-full min-h-[240px] w-full overflow-hidden bg-bfl-surface">
                  <Image
                    src={active.image}
                    alt={active.name}
                    fill
                    sizes="420px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-full min-h-[240px] flex-col justify-end bg-bfl-yellow p-6">
                  <p className="text-[28px] font-bold leading-tight text-black">{active.name}</p>
                  <p className="mt-1 text-[14px] text-black/70">
                    {active.count ? `${active.count} items` : "Shop the department"} →
                  </p>
                </div>
              )}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Splits children into N roughly equal columns, preserving order. */
function chunk<T>(items: T[], columns: number): T[][] {
  const perColumn = Math.ceil(items.length / columns);
  return Array.from({ length: Math.min(columns, Math.ceil(items.length / perColumn)) }, (_, i) =>
    items.slice(i * perColumn, (i + 1) * perColumn)
  );
}
