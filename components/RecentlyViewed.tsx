"use client";

import Link from "next/link";
import Image from "next/image";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { formatPrice } from "@/lib/currency";

export default function RecentlyViewed() {
  const { items } = useRecentlyViewed();

  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">Recently viewed</h2>
        <span className="text-xs text-gray-400">{items.length} items</span>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {items.map((item) => (
          <Link
            key={item.productId}
            href={`/products/${item.productId}`}
            className="shrink-0 w-28 group"
          >
            <div className="aspect-square bg-[#f7f7f7] rounded-lg overflow-hidden relative">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="112px"
                className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-600 line-clamp-1 leading-tight">
              {item.name}
            </p>
            <p className="text-xs font-bold text-market mt-0.5">
              {formatPrice(item.price)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

