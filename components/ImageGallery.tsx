"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  images: string[];
  productName: string;
  activeImage: string | null;
  setActiveImage: (image: string) => void;
  /** NEW flag, for recently listed products. */
  isNew?: boolean;
  /** "−N%" flag in the top-left corner. */
  discount?: number;
  /** Super price flag, for deep discounts. */
  superPrice?: boolean;
  /**
   * Nothing left to sell.
   *
   * Fades the photograph and stamps it, the way the product card already does.
   * The state has to be readable from the picture alone: on a phone the buy
   * button is a screen below the image, and a shopper who has scrolled to a
   * product from a rail should not have to reach it to find out the item is
   * gone.
   */
  soldOut?: boolean;
};

/**
 * Product gallery, following the Next.js Commerce gallery: one large square
 * white frame showing the whole product with `object-contain`, a single
 * rounded arrow pill floating over its bottom edge, and a row of bordered
 * square thumbnails underneath that highlight the active shot.
 *
 * Clicking the frame opens a full-size lightbox.
 */
export default function ImageGallery({
  images,
  productName,
  activeImage,
  setActiveImage,
  isNew = false,
  discount = 0,
  superPrice = false,
  soldOut = false,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState(false);

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
      <div className="flex aspect-square w-full items-center justify-center rounded-[4px] border border-shop-line bg-white text-sm text-shop-muted">
        No image
      </div>
    );
  }

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
    <div>
      {/* Main frame */}
      <div className="relative aspect-square w-full overflow-hidden rounded-[4px] border border-shop-line bg-white">
        <button
          type="button"
          onClick={() => setLightbox(true)}
          aria-label="Open full-size image"
          className="absolute inset-0 h-full w-full cursor-zoom-in"
        >
          <Image
            key={activeImage}
            src={activeImage || images[0]}
            alt={`${productName} — image ${activeIndex + 1}`}
            fill
            sizes="(min-width: 1024px) 680px, 100vw"
            className={`h-full w-full object-contain p-1.5 ${soldOut ? "opacity-45" : ""}`}
            priority
          />
        </button>

        {/* Sold out, across the middle of the frame.
            Centred rather than tucked in a corner with the other flags: this is
            not a badge competing for attention with a discount, it is the one
            fact that decides whether the rest of the page is worth reading. */}
        {soldOut && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-shop-ink/90 px-5 py-2 text-[14px] font-semibold uppercase tracking-[0.08em] text-white">
              Sold out
            </span>
          </div>
        )}

        {/* Flags. Suppressed when the item is gone — a "−40%" on something
            nobody can buy is an advert for a disappointment. */}
        <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-2">
          {!soldOut && discount > 0 && (
            <span className="rounded-full bg-shop-sale px-3 py-1 text-[13px] font-semibold text-white">
              −{discount}%
            </span>
          )}
          {!soldOut && superPrice && (
            <span className="rounded-full bg-shop-flame px-3 py-1 text-[13px] font-semibold text-white">
              Super price
            </span>
          )}
          {!soldOut && isNew && !superPrice && discount === 0 && (
            <span className="rounded-full bg-pop-green px-3 py-1 text-[13px] font-semibold text-white">
              New in
            </span>
          )}
        </div>

        {/* Share sits opposite the flags. */}
        <button
          type="button"
          onClick={share}
          aria-label="Share this product"
          className="absolute right-4 top-4 flex h-9 items-center gap-2 rounded-full border border-shop-line bg-white/70 px-3 text-[13px] text-shop-body backdrop-blur-md transition-colors hover:text-shop-ink"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12M12 3 8 7m4-4 4 4M5 13v6h14v-6" />
          </svg>
          {copied ? "Copied" : "Share"}
        </button>

        {/* Single arrow pill, centred on the bottom edge. */}
        {images.length > 1 && (
          <div className="absolute bottom-[15%] flex w-full justify-center">
            <div className="mx-auto flex h-11 items-center rounded-full border border-shop-line bg-white/70 text-shop-ink backdrop-blur-md">
              <button
                type="button"
                aria-label="Previous product image"
                onClick={() => step(-1)}
                className="flex h-full items-center justify-center px-6 transition-all ease-in-out hover:scale-110"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="mx-1 h-6 w-px bg-shop-line" />
              <button
                type="button"
                aria-label="Next product image"
                onClick={() => step(1)}
                className="flex h-full items-center justify-center px-6 transition-all ease-in-out hover:scale-110"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail row */}
      {images.length > 1 && (
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {images.map((src, i) => (
            <li key={src} className="h-20 w-20">
              <button
                type="button"
                onClick={() => setActiveImage(src)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === activeIndex}
                className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[4px] border bg-white transition-colors hover:border-shop-primary ${
                  i === activeIndex ? "border-2 border-shop-primary" : "border-shop-line"
                }`}
              >
                <Image
                  src={src}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-contain p-1"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

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
