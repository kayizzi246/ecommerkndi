"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = {
  images: string[];
  productName: string;
  activeImage: string | null;
  setActiveImage: (image: string) => void;
  /** Green NEW flag, for recently listed products. */
  isNew?: boolean;
  /** Red "-N% OFF" flag in the top-right corner. */
  discount?: number;
  /** Red SUPER PRICE flag along the bottom edge. */
  superPrice?: boolean;
};

/**
 * Brands For Less product gallery.
 *
 * The frame is deliberately capped rather than stretched to the column: a
 * contained frame keeps the product large *relative to its box*, which is what
 * makes the shot read as big. Rollover pans a magnified copy inside that frame
 * (nothing escapes the container), and a click opens the full-size lightbox.
 */
export default function ImageGallery({
  images,
  productName,
  activeImage,
  setActiveImage,
  isNew = false,
  discount = 0,
  superPrice = false,
}: Props) {
  const [zooming, setZooming] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const activeIndex = Math.max(0, activeImage ? images.indexOf(activeImage) : 0);

  // Escape closes the lightbox and the page stops scrolling behind it.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] max-w-[520px] items-center justify-center bg-bfl-surface text-sm text-bfl-grey">
        No image
      </div>
    );
  }

  const trackCursor = (event: React.MouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  const step = (direction: 1 | -1) => {
    const next = (activeIndex + direction + images.length) % images.length;
    setActiveImage(images[next]);
  };

  const share = async () => {
    const url = typeof window === "undefined" ? "" : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: productName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed — nothing to recover from.
    }
  };

  return (
    <div className="mx-auto w-full max-w-[600px] lg:mx-0">
      <div className="flex gap-3">
        {/* Thumbnail rail */}
        {images.length > 1 && (
          <div className="flex max-h-[600px] shrink-0 flex-col gap-2 overflow-y-auto no-scrollbar">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onMouseEnter={() => setActiveImage(src)}
                onClick={() => setActiveImage(src)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === activeIndex}
                className={`relative h-[86px] w-[68px] shrink-0 overflow-hidden border bg-white transition-colors ${
                  i === activeIndex ? "border-bfl-yellow" : "border-bfl-line hover:border-[#b0b0b0]"
                }`}
              >
                <Image src={src} alt="" fill sizes="68px" className="object-contain p-1" />
              </button>
            ))}
          </div>
        )}

        {/* Main frame */}
        <div
          ref={frameRef}
          onMouseEnter={() => setZooming(true)}
          onMouseLeave={() => setZooming(false)}
          onMouseMove={trackCursor}
          onClick={() => setLightbox(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setLightbox(true);
            if (event.key === "ArrowRight") step(1);
            if (event.key === "ArrowLeft") step(-1);
          }}
          aria-label="Open full-size image"
          className="relative aspect-[3/4] flex-1 cursor-zoom-in overflow-hidden bg-[#f5f5f5]"
        >
          <Image
            key={activeImage}
            src={activeImage || images[0]}
            alt={`${productName} — image ${activeIndex + 1}`}
            fill
            sizes="(max-width: 1024px) 92vw, 520px"
            className="object-contain p-3 transition-transform duration-200 ease-out"
            style={{ transform: zooming ? "scale(2.2)" : "scale(1)", transformOrigin: origin }}
            priority
          />

          {discount > 0 && (
            <span className="pointer-events-none absolute right-0 top-4 bg-bfl-red px-3 py-1.5 text-[13px] font-bold text-white">
              {discount}% OFF
            </span>
          )}
          {superPrice && (
            <span className="pointer-events-none absolute bottom-0 left-0 bg-bfl-red px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white">
              Super Price
            </span>
          )}
          {isNew && !superPrice && (
            <span className="pointer-events-none absolute bottom-0 left-0 bg-bfl-green px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white">
              New
            </span>
          )}

          {/* Mobile arrows — desktop uses the thumbnail rail */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation();
                  step(-1);
                }}
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md md:hidden"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation();
                  step(1);
                }}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md md:hidden"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Share / zoom hint */}
      <div className="mt-4 flex items-center gap-10 md:pl-[80px]">
        <button
          type="button"
          onClick={share}
          className="flex items-center gap-2 text-[13px] text-[#333] hover:text-black"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12M12 3 8 7m4-4 4 4M5 13v6h14v-6" />
          </svg>
          {copied ? "Link copied" : "Share"}
        </button>

        <span className="hidden items-center gap-2 text-[13px] text-bfl-grey md:flex">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6.5" />
            <path strokeLinecap="round" d="M20 20l-4.4-4.4M9 11h4M11 9v4" />
          </svg>
          Rollover image to zoom
        </span>
      </div>

      {/* Full-size lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(false)}
            className="absolute inset-0 cursor-zoom-out"
          />
          <div className="relative h-[85vh] w-full max-w-[900px]">
            <Image
              src={activeImage || images[0]}
              alt={`${productName} — full size`}
              fill
              sizes="900px"
              className="object-contain"
            />
          </div>
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Close full-size image"
            className="absolute right-5 top-5 text-3xl leading-none text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
