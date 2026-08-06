"use client";

import Link from "next/link";
import Image from "next/image";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { formatPrice } from "@/lib/currency";

export default function RecentlyViewed() {
  const { items } = useRecentlyViewed();

  if (items.length === 0) return null;

  return (
    <section className="mt-12 border-t border-bfl-line pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[20px] font-normal text-black">Recently viewed</h2>
        <span className="text-[12px] text-bfl-grey">{items.length} items</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {items.map((item) => (
          <Link
            key={item.productId}
            href={`/products/${item.productId}`}
            className="group w-28 shrink-0"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-bfl-surface">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="112px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-tight text-[#4a4a4a]">
              {item.name}
            </p>
            <p className="mt-1 text-[13px] font-bold text-black">{formatPrice(item.price)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

