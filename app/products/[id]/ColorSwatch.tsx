"use client";

import Image from "next/image";
import type { ProductAttributeOption } from "@/lib/woocommerce";

type Props = {
  options: ProductAttributeOption[];
  value: string | null;
  onChange: (value: string) => void;
  isOptionAvailable: (optionName: string) => boolean;
};

/**
 * The colour picker, in one of two shapes.
 *
 * ---- Photographs when there are photographs, dots when there are not ----
 *
 * A colour name is a poor description of a product: "Multicolor" says nothing,
 * and "Beige" on a printed fabric says almost as little. A picture of the shoe
 * in that colour says all of it at once, which is why every marketplace this
 * shop is measured against shows colour options as thumbnails.
 *
 * The decision is made for the whole SET rather than per option: if any option
 * carries an image, every option renders as a tile, and the ones without a
 * picture fall back to a filled square inside that tile. Mixing 36px dots and
 * 56px photographs in one row is worse than either alone — the row loses its
 * baseline and the dots read as an afterthought — and a half-photographed set
 * is the normal state of a catalogue somebody is still filling in.
 *
 * With no images anywhere it stays the dot row it has always been, so a product
 * whose colours are genuinely just colours is not padded out with empty tiles.
 */
export default function ColorSwatch({ options, value, onChange, isOptionAvailable }: Props) {
  const hasImages = options.some((option) => Boolean(option.image));

  if (hasImages) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const available = isOptionAvailable(option.name);
          const active = value === option.name;
          return (
            <button
              key={option.name}
              type="button"
              disabled={!available}
              onClick={() => onChange(option.name)}
              title={option.name}
              aria-label={`Select colour ${option.name}`}
              aria-pressed={active}
              className={`relative h-[60px] w-[60px] overflow-hidden rounded-xl bg-shop-photo transition-shadow disabled:cursor-not-allowed ${
                active
                  ? "ring-2 ring-shop-primary ring-offset-2"
                  : "ring-1 ring-shop-line hover:ring-shop-primary"
              } ${available ? "" : "opacity-45"}`}
            >
              {option.image ? (
                <Image
                  src={option.image}
                  alt=""
                  fill
                  sizes="60px"
                  className="object-cover"
                  quality={90}
                />
              ) : (
                // No photograph for this one: the tile still holds a colour, so
                // the row keeps its rhythm and the option stays pickable.
                <span
                  aria-hidden
                  className="absolute inset-1.5 rounded-lg ring-1 ring-black/10"
                  style={{ backgroundColor: option.value || option.name.toLowerCase() }}
                />
              )}
              {!available && (
                <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                  <span className="h-px w-[85%] rotate-45 bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const available = isOptionAvailable(option.name);
        return (
          <button
            key={option.name}
            type="button"
            disabled={!available}
            onClick={() => onChange(option.name)}
            title={option.name}
            // A ring rather than a border, so the swatch colour keeps its full
            // area and the selected state never resizes the dot.
            className={`relative h-9 w-9 rounded-full transition-shadow disabled:cursor-not-allowed ${
              value === option.name
                ? "ring-2 ring-shop-ink ring-offset-2"
                : "ring-1 ring-black/10 hover:ring-shop-line hover:ring-offset-2"
            }`}
            style={{ backgroundColor: option.value || option.name.toLowerCase() }}
            aria-label={`Select color ${option.name}`}
          >
            {!available && <span className="absolute inset-0 flex items-center justify-center"><span className="w-full h-px bg-white/80 rotate-45"></span><span className="w-full h-px bg-white/80 -rotate-45 absolute"></span></span>}
          </button>
        );
      })}
    </div>
  );
}
