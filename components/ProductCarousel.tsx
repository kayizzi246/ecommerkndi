"use client";

import { useRef } from "react";
import type { Product } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";

/**
 * "You May Also Like" rail — a horizontally scrolling row of PLP tiles with
 * the circular chevron controls Brands For Less overlays on the edges.
 */
export default function ProductCarousel({
  title,
  products,
}: {
  title: string;
  products: Product[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (products.length === 0) return null;

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="relative mt-16">
      <h2 className="mb-6 text-[24px] font-extrabold text-shop-ink md:text-[28px]">{title}</h2>

      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto scroll-smooth no-scrollbar"
      >
        {products.map((product) => (
          <div key={product.id} className="w-[46%] shrink-0 sm:w-[31%] md:w-[23%] lg:w-[18%]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {products.length > 4 && (
        <>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Previous products"
            className="absolute left-0 top-[38%] hidden h-10 w-10 items-center justify-center rounded-full border border-shop-line bg-white text-shop-ink shadow-sm transition-colors hover:bg-shop-surface md:flex"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Next products"
            className="absolute right-0 top-[38%] hidden h-10 w-10 items-center justify-center rounded-full border border-shop-line bg-white text-shop-ink shadow-sm transition-colors hover:bg-shop-surface md:flex"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </section>
  );
}
