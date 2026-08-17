"use client";

import Link from "next/link";
import Image from "next/image";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { formatPrice } from "@/lib/currency";

/**
 * The rail of what this visitor has already looked at.
 *
 * `className` exists because the two places it renders space themselves
 * differently: the product page stacks sections with margins, so it keeps the
 * `mt-12` default, while the homepage lays its sections out in a flex column
 * with a gap — where a margin on top of the gap is a double helping of it.
 */
export default function RecentlyViewed({ className = "mt-12" }: { className?: string }) {
  const { items } = useRecentlyViewed();

  // Nothing is drawn for a first-time visitor, which is what makes this safe to
  // place high on the homepage: it costs a new shopper no space at all, and a
  // returning one gets the thing they were last looking at above the fold.
  if (items.length === 0) return null;

  return (
    <section className={className}>
      {/* 12px, the same heading-to-content gap `SectionHeader` uses. This was
          16px, which on the homepage made this the one rail sitting looser than
          every other — see the spacing note in `app/page.tsx`. */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title text-[20px] text-shop-ink md:text-[24px]">
          Recently viewed
        </h2>
        <span className="text-[13px] text-shop-muted">{items.length} items</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {items.map((item) => (
          <Link
            key={item.productId}
            href={`/products/${item.productId}`}
            className="group w-28 shrink-0"
          >
            {/* ---- The image, when there is one ----
                 A product with no photograph stores `image: ""` in the
                 recently-viewed list, and an empty string is the one value
                 `next/image` refuses: it throws `Image is missing required
                 "src" property`, and the browser treats `src=""` as a request
                 for the current page — so an imageless product in this rail
                 downloaded the whole page again for every tile.

                 The guard is on the value rather than a fallback `src`, because
                 there is no image to fall back to; the tile draws the same empty
                 frame the product card uses so the rail keeps its shape. */}
            <div className="relative aspect-square overflow-hidden rounded-lg border border-shop-line bg-white">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="112px"
                  className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-shop-muted">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <circle cx="8.5" cy="10" r="1.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 3-2 4 3" />
                  </svg>
                </div>
              )}
            </div>
            <p className="mt-2 text-[15px] font-semibold leading-none text-shop-ink">
              {formatPrice(item.price)}
            </p>
            <p className="mt-1 line-clamp-2 text-[13px] leading-tight text-shop-body">
              {item.name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

