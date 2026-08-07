"use client";

import type { ProductAttributeOption } from "@/lib/woocommerce";

type Props = {
  options: ProductAttributeOption[];
  value: string | null;
  onChange: (value: string) => void;
  isOptionAvailable: (optionName: string) => boolean;
};

export default function ColorSwatch({ options, value, onChange, isOptionAvailable }: Props) {
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