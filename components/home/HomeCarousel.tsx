"use client";

import Link from "@/components/IntentLink";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/woocommerce";

/**
 * A swipeable row of full product cards under the campaign banner, with
 * arrows on a desktop. Same card as the grid below it, so a product looks the
 * same wherever it appears.
 */
export default function HomeCarousel({
  title,
  href,
  products,
  tone,
}: {
  title: string;
  href: string;
  products: Product[];
  /**
   * A colour theme (`men`, `women`, `kids`, `home`, `new`, …) from
   * storefront-campaign.css. The panel washes into it as it scrolls into view.
   */
  tone?: string;
}) {
  // Several carousels share the page, so each heading needs its own id.
  const titleId = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 1);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateArrows]);

  if (products.length < 4) return null;

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section
      className={`hx-panel hx-carousel ${tone ? `hx-tone hx-tone-${tone}` : ""}`}
      aria-labelledby={titleId}
    >
      <div className="hx-panel-head">
        <h2 id={titleId} className="hx-panel-title">
          {title}
        </h2>
        <Link href={href} className="hx-see-all">
          See all ›
        </Link>
      </div>
      <div className="relative">
        <ul ref={trackRef} onScroll={updateArrows} className="hx-carousel-track no-scrollbar">
          {products.map((product, index) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                priority={index < 2}
                sizes="(max-width: 640px) 44vw, (max-width: 1024px) 24vw, 220px"
              />
            </li>
          ))}
        </ul>
        {canPrev && (
          <button type="button" aria-label="Previous products" onClick={() => scroll(-1)} className="hx-arrow hx-arrow-prev">
            ‹
          </button>
        )}
        {canNext && (
          <button type="button" aria-label="More products" onClick={() => scroll(1)} className="hx-arrow hx-arrow-next">
            ›
          </button>
        )}
      </div>
    </section>
  );
}
