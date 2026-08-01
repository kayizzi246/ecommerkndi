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
            className={`relative w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 disabled:cursor-not-allowed ${
              value === option.name ? "border-market" : "border-transparent"
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