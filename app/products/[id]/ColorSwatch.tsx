"use client";

import Image from "next/image";
import type { ProductAttributeOption } from "@/lib/woocommerce";
import { colourFill, splitColourName } from "@/lib/colour-names";

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
      <div className="flex flex-wrap gap-3">
        {options.map((option) => {
          const available = isOptionAvailable(option.name);
          const active = value === option.name;
          return (
            <div key={option.name} className="flex w-[84px] flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={!available}
              onClick={() => onChange(option.name)}
              title={option.name}
              aria-label={`Select colour ${option.name}`}
              aria-pressed={active}
              className={`color-photo relative h-[84px] w-[84px] overflow-hidden rounded-2xl bg-shop-photo disabled:cursor-not-allowed ${
                active ? "color-photo-on" : ""
              } ${available ? "" : "opacity-45"}`}
            >
              {option.image ? (
                <Image
                  src={option.image}
                  alt=""
                  fill
                  sizes="84px"
                  className="object-cover"
                  quality={90}
                />
              ) : (
                // No photograph for this one: the tile still holds a colour, so
                // the row keeps its rhythm and the option stays pickable.
                <span
                  aria-hidden
                  className="absolute inset-1.5 rounded-lg ring-1 ring-black/10"
                  style={{ background: colourFill(option.name, option.value) ?? "#e5e7eb" }}
                />
              )}
              {!available && (
                <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                  <span className="h-px w-[85%] rotate-45 bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                </span>
              )}
            </button>
            <span
              className={`w-full truncate text-center text-[13px] leading-4 ${
                active ? "font-[800] text-black" : "font-semibold text-shop-body"
              } ${available ? "" : "line-through"}`}
            >
              {option.name}
            </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const available = isOptionAvailable(option.name);
        const active = value === option.name;
        const fill = colourFill(option.name, option.value);
        const { colour, code } = splitColourName(option.name);
        /* A swatch card: the colour as a dot, the colour name in bold, and an
           imported code ("AVA" in "AVA-Pink") small above it. The dot is
           painted from the colour word inside the name and left out when there
           is none ("2pcs"), so no option shows an empty circle. */
        return (
          <button
            key={option.name}
            type="button"
            disabled={!available}
            onClick={() => onChange(option.name)}
            title={available ? option.name : `${option.name} — sold out`}
            aria-pressed={active}
            aria-label={`Select colour ${option.name}${available ? "" : ", sold out"}`}
            className={`color-chip ${active ? "color-chip-on" : ""}`}
          >
            {fill && (
              <span aria-hidden className="color-chip-dot" style={{ background: fill }}>
                {!available && <span className="color-chip-slash" />}
              </span>
            )}
            <span className="flex min-w-0 flex-col items-start leading-tight">
              {code && <span className="color-chip-code">{code}</span>}
              <span className="color-chip-name">{colour}</span>
              {!available && <span className="color-chip-code">Sold out</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
