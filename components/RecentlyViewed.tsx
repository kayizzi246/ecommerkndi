"use client";

import Link from "next/link";
import Image from "next/image";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { formatPrice } from "@/lib/currency";

export default function RecentlyViewed() {
  const { items } = useRecentlyViewed();

  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between">
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
            <div className="relative aspect-square overflow-hidden rounded-lg border border-shop-line bg-white">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="112px"
                className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
              />
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

