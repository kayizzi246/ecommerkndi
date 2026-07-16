"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import type { Product } from "@/lib/woocommerce";

export default function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { notify } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const attributes = product.attributes ?? [];

  if (product.stock_status === "outofstock") {
    return (
      <button
        disabled
        className="w-full bg-gray-200 text-gray-500 font-bold uppercase py-4 cursor-not-allowed"
      >
        Sold out
      </button>
    );
  }

  const add = () => {
    const missing = attributes.find((attr) => !selected[attr.name]);
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
        options: attributes.length > 0 ? selected : undefined,
      },
      quantity
    );
    notify("Added to cart", { image: product.image, showBagLink: true });
  };

  return (
    <div className="space-y-5">
      {/* Option pickers (e.g. Size) */}
      {attributes.map((attr) => (
        <div key={attr.name}>
          <p className="text-sm font-bold mb-2">
            {attr.name}
            {selected[attr.name] && (
              <span className="font-normal text-gray-500">
                : {selected[attr.name]}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {attr.options.map((option) => {
              const active = selected[attr.name] === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSelected((prev) => ({ ...prev, [attr.name]: option }));
                    setError(null);
                  }}
                  className={`min-w-14 px-3 py-2.5 border text-sm font-semibold transition-colors ${
                    active
                      ? "border-black bg-black text-white"
                      : "border-gray-300 hover:border-black"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}

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
          className="flex-1 bg-sun hover:brightness-95 text-black font-extrabold uppercase tracking-wide py-4 transition"
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
