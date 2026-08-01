"use client";

import Image from "next/image";

type Props = {
  images: string[];
  productName: string;
  activeImage: string | null;
  setActiveImage: (image: string) => void;
};

export default function ImageGallery({ images, productName, activeImage, setActiveImage }: Props) {
  const activeIndex = activeImage ? images.indexOf(activeImage) : 0;

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-[#f5f5f5] flex items-center justify-center text-gray-400 text-sm">
        No image
      </div>
    );
  }

  const prev = () => setActiveImage(images[activeIndex > 0 ? activeIndex - 1 : images.length - 1]);
  const next = () => setActiveImage(images[activeIndex < images.length - 1 ? activeIndex + 1 : 0]);

  return (
    <div className="flex flex-col gap-3">
      {/* Main Image */}
      <div className="relative aspect-square bg-[#f5f5f5] rounded-lg overflow-hidden group">
        <Image
          key={activeImage} // Force re-render on image change for transition
          src={activeImage || images[0]}
          alt={`${productName} - image ${activeIndex + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 55vw"
          className="object-cover transition-opacity duration-300"
          priority
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full border border-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full border border-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        {/* Image counter badge */}
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
            {activeIndex + 1}/{images.length}
          </span>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {images.slice(0, 6).map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActiveImage(src)}
              className={`relative w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-md border-2 overflow-hidden transition-all ${
                i === activeIndex
                  ? "border-market ring-1 ring-market/30"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <Image
                src={src}
                alt={`${productName} thumbnail ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom hint */}
      <p className="text-[11px] text-gray-400 text-center hidden md:block">
        Hover or tap to zoom
      </p>
    </div>
  );
}
