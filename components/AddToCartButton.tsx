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

export default function AddToCartButton({ product, onOptionChange }: Props) {
  const { addItem } = useCart();
  const { notify } = useToast();
  const [quantity, setQuantity] = useState(1);
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
      <button
        disabled
        className="w-full bg-gray-200 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 cursor-not-allowed"
      >
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-800">
                Color: <span className="font-bold text-gray-900">{selected[attr.name] || 'Select a color'}</span>
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

        // Render standard buttons for other attributes like 'Size'
        return (
          <div key={attr.name}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-800">
              {attr.name}: <span className="font-bold text-gray-900">{selected[attr.name] || `Select a ${attr.name.toLowerCase()}`}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {attr.options.map((option) => {
                const available = isOptionAvailable(attr.name, option.name);
                const active = selected[attr.name] === option.name;
                return (
                  <button key={option.name} type="button" disabled={!available} onClick={() => {
                      handleSelect(attr.name, option.name);
                    }} className={`relative min-w-14 border px-3 py-3 text-sm font-semibold transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200 ${
                      active ? "border-black bg-black text-white" : "border-gray-300 hover:border-black"
                    }`}>
                    {option.name}
                    {!available && <span className="absolute inset-0 flex items-center justify-center"><span className="w-4/5 h-px bg-gray-400 rotate-[-10deg]"></span></span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {error && <p className="text-sale text-sm font-semibold">{error}</p>}

      <div className="flex items-stretch gap-3">
        <label className="border border-gray-300 px-3 flex flex-col justify-center shrink-0">
          <span className="text-[10px] uppercase text-gray-500 font-bold">
            Qty
          </span>
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="text-sm font-bold focus:outline-none bg-transparent pr-1"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={add}
          className="flex-1 bg-black py-4 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-black/75"
        >
          Add to cart
        </button>

        <button
          type="button"
          aria-label="Save to wishlist"
          onClick={() => notify("Saved to your wishlist ♥")}
          className="w-14 border border-gray-300 hover:border-black rounded-full flex items-center justify-center shrink-0"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
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
