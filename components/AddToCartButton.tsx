"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import type { Product } from "@/lib/woocommerce"; 
import ColorSwatch from "../app/products/[id]/ColorSwatch";

type Props = {
  product: Product;
  onOptionChange?: (name: string, value: string | null) => void;
};

/** Size charts shoppers can switch between; the chips themselves are the store's own labels. */
const SIZE_SYSTEMS = ["EU", "UK", "US"];

export default function AddToCartButton({ product, onOptionChange }: Props) {
  const { addItem } = useCart();
  const { notify } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [sizeSystem, setSizeSystem] = useState(SIZE_SYSTEMS[0]);
  const [selected, setSelected] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    product.attributes?.forEach(attr => initial[attr.name] = null);
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (name: string, value: string) => {
    setSelected(prev => ({ ...prev, [name]: value }));
    setError(null);
    onOptionChange?.(name, value);
  };

  const isOptionAvailable = (attrName: string, optionName: string) => {
    if (!product.variations || product.variations.length === 0) {
      return true; // Simple product, always available
    }

    // Check if any variation with this option is in stock, considering other selections.
    return product.variations.some(variation => {
      if (!variation.is_in_stock) return false;

      // Does this variation match the option we're checking?
      const hasOption = Object.entries(variation.attributes).some(
        ([key, val]) => key === attrName && val === optionName
      );
      if (!hasOption) return false;

      // Does this variation also match all *other* selected options?
      return Object.entries(selected).every(([selectedAttr, selectedVal]) => {
        if (!selectedVal || selectedAttr === attrName) return true; // Ignore the attribute we're currently checking or unselected ones
        return variation.attributes[selectedAttr] === selectedVal;
      });
    });
  };

  const attributes = product.attributes ?? [];

  if (product.stock_status === "outofstock") {
    return (
      <button disabled className="btn-bfl w-full py-4 text-[13px]">
        Sold out
      </button>
    );
  }

  const add = () => {
    const missing = attributes.find((attr) => !selected[attr.name] && attr.options.length > 0);
    if (missing) {
      setError(`Please select a ${missing.name.toLowerCase()}`);
      return;
    }
    setError(null);
    addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        options: attributes.length > 0 ? (selected as Record<string, string>) : undefined,
      },
      quantity
    );
    notify("Added to cart", { image: product.image, showBagLink: true });
  };

  return (
    <div className="space-y-5">
      {/* Option pickers (e.g. Size) */}
      {attributes.map((attr) => {
        if (attr.options.length === 0) return null;

        // Render color swatches for 'Color' attribute
        if (attr.name.toLowerCase() === 'color') {
          return (
            <div key={attr.name}>
              <p className="mb-2 text-[13px] text-[#333]">
                Color: <span className="font-bold text-black">{selected[attr.name] || 'Select a color'}</span>
              </p>
              <ColorSwatch
                options={attr.options}
                value={selected[attr.name]}
                isOptionAvailable={(optionName) => isOptionAvailable(attr.name, optionName)}
                onChange={(colorName) => {
                  handleSelect(attr.name, colorName);
                }}
              />
            </div>
          );
        }

        // Size and other text options render as the BFL square chips.
        const isSize = ["size", "sizes", "shoe size"].includes(attr.name.toLowerCase());

        return (
          <div key={attr.name}>
            <div className="flex flex-wrap gap-2">
              {attr.options.map((option) => {
                const available = isOptionAvailable(attr.name, option.name);
                const active = selected[attr.name] === option.name;
                return (
                  <button
                    key={option.name}
                    type="button"
                    disabled={!available}
                    onClick={() => handleSelect(attr.name, option.name)}
                    className={`relative min-w-[58px] border px-4 py-3 text-[13px] transition-colors disabled:cursor-not-allowed disabled:border-bfl-line disabled:bg-bfl-surface disabled:text-[#bbb] ${
                      active
                        ? "border-black font-bold text-black"
                        : "border-bfl-line text-[#333] hover:border-[#8a8a8a]"
                    }`}
                  >
                    {option.name}
                    {!available && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="h-px w-4/5 rotate-[-18deg] bg-[#cfcfcf]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Size-system switch, as on the BFL size row */}
            {isSize && (
              <select
                aria-label="Size system"
                value={sizeSystem}
                onChange={(event) => setSizeSystem(event.target.value)}
                className="mt-3 w-[150px] border border-bfl-line bg-white px-3 py-2.5 text-[13px] focus:border-black focus:outline-none"
              >
                {SIZE_SYSTEMS.map((system) => (
                  <option key={system}>{system}</option>
                ))}
              </select>
            )}
          </div>
        );
      })}

      {error && <p className="text-[13px] font-bold text-bfl-red">{error}</p>}

      <div className="flex items-stretch gap-3">
        <label className="flex w-[76px] shrink-0 flex-col justify-center border border-bfl-line px-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-bfl-grey">Qty.</span>
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            aria-label="Quantity"
            className="-ml-0.5 bg-transparent text-[14px] font-bold focus:outline-none"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={add} className="btn-bfl flex-1 py-4 text-[14px] tracking-wide">
          Add to cart
        </button>

        <button
          type="button"
          aria-label="Save to wishlist"
          onClick={() => notify("Saved to your wishlist ♥")}
          className="flex w-14 shrink-0 items-center justify-center rounded-full bg-bfl-surface text-[#333] transition-colors hover:bg-[#ececec]"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
