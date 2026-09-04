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
      <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[4px] border border-shop-line bg-white text-sm text-shop-muted">
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
      {/* ---- Gallery layout ----
           A vertical strip of thumbnails to the left of the frame on a desktop,
           and the same strip laid out horizontally underneath it on a phone.

           The strip used to be a wrapped row below the frame in every case,
           which on a product with eight shots became two rows of 80px squares —
           roughly 170px of gallery furniture sitting directly between the
           photograph and the price. Standing them up the side costs no vertical
           space at all, puts every shot in view without scrolling, and is what
           every large marketplace does on a wide screen for exactly that
           reason. Below `lg` there is no width to spare for a side rail, so it
           becomes a single scrolling row instead. */}
      <div className="flex gap-3">
        {images.length > 1 && (
          <ul className="hidden w-[64px] shrink-0 flex-col gap-2 lg:flex">
            {images.map((src, i) => (
              <li key={src}>
                <button
                  type="button"
                  onClick={() => setActiveImage(src)}
                  aria-label={`View image ${i + 1}`}
                  aria-current={i === activeIndex}
                  className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-[4px] border bg-white transition-colors hover:border-shop-primary ${
                    i === activeIndex ? "border-2 border-shop-primary" : "border-shop-line"
                  }`}
                >
                  <Image
                    src={src}
                    alt=""
                    width={64}
                    height={64}
                    quality={90}
                    className="h-full w-full object-contain p-1"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ---- Main frame: 4:5, where this was square ----

             The gallery column ends where the description begins, and with a
             square frame it ended about 200px short of it — a band of white
             down the left of the page between the photograph and the first
             tab, on the one screen where the photograph is the argument.

             Portrait rather than merely bigger. Most of this catalogue is
             clothing, shoes and packaged goods shot upright, so 4:5 is the
             shape the stock already is; a taller square would have added the
             same height and then filled it with background. `object-contain`
             means nothing is cropped either way — a genuinely landscape shot
             letterboxes into the frame exactly as it did before.

             The cap on the column moved with it (`ProductPurchase`, 560 → 640),
             because height alone would have made the frame narrow and tall.
             Both numbers are one decision: they are what puts the foot of the
             gallery level with the description beside it. */}
        <div className="relative aspect-[4/5] min-w-0 flex-1 overflow-hidden rounded-[4px] border border-shop-line bg-white">
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
            quality={90}
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
            /* Red, with every other percentage in the shop — the grid tile's
               corner flag, the mini tile's, and the "Save x%" chip in the price
               row below this picture. A shopper who saw −40% on the tile they
               tapped should meet the same mark in the same colour here; it was
               the brand's burnt orange, which made the product page the one
               place the shop said "reduced" in a different voice. */
            <span className="rounded-full bg-[color:var(--color-shop-price-was)] px-3 py-1 text-[13px] font-bold text-white">
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

      </div>

      {/* The same thumbnails under the frame, for the screens too narrow to
          carry the side rail. One scrolling row rather than a wrapping grid, so
          a product with eight shots costs exactly as much height as one with
          three. */}
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar lg:hidden">
          {images.map((src, i) => (
            <li key={src} className="h-16 w-16 shrink-0">
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
                  width={64}
                  height={64}
                  quality={90}
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
              quality={90}
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
