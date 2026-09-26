"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import { useWishlist } from "@/lib/wishlist";
import type { Product } from "@/lib/woocommerce";
import { matchVariation, variationPrice } from "@/lib/variation-match";
import { formatPrice } from "@/lib/currency";
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
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const saved = isWishlisted(product.id);
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [sizeSystem, setSizeSystem] = useState(SIZE_SYSTEMS[0]);
  const [selected, setSelected] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    product.attributes?.forEach(attr => initial[attr.name] = null);
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  // Sticky buy bar: shown once the real Add to cart button scrolls out of view,
  // so the action is always one tap away on a long product page.
  const actionRef = useRef<HTMLDivElement>(null);
  const [actionVisible, setActionVisible] = useState(true);

  useEffect(() => {
    const node = actionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActionVisible(entry.isIntersecting),
      { rootMargin: "-80px 0px 0px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
      <button disabled className="btn-shop w-full py-4 text-[14px]">
        Sold out
      </button>
    );
  }

  /**
   * Put the item in the basket. Returns whether it actually went in, so the
   * "Buy now" path below can tell a successful add from a blocked one and only
   * navigate on the former — sending a shopper to the checkout after refusing
   * to add the item would land them on an empty basket with no explanation.
   */
  const add = (): boolean => {
    const missing = attributes.find((attr) => !selected[attr.name] && attr.options.length > 0);
    if (missing) {
      setError(`Please select a ${missing.name.toLowerCase()}`);
      // The sticky bar can trigger this from far down the page, so bring the
      // pickers — and the message — back into view.
      actionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    setError(null);

    // Which variation that choice actually is. Resolved here because this is
    // one of only two places holding the variation matrix — see
    // `lib/variation-match.ts` for why the basket needs the id and not just the
    // words the shopper picked.
    const variation = matchVariation(product, selected);

    addItem(
      {
        productId: product.id,
        variationId: variation?.id,
        name: product.name,
        // The variation's own price when it has one, so a basket line for an XL
        // shows the XL's price rather than the parent's.
        price: variationPrice(product, selected),
        image: product.image,
        options: attributes.length > 0 ? (selected as Record<string, string>) : undefined,
      },
      quantity
    );
    notify("Added to cart", { image: product.image, showBagLink: true });
    return true;
  };

  /**
   * The same add, followed straight by the checkout.
   *
   * A second action beside the first, because "add to cart" and "buy this" are
   * different intentions and the page was only serving one of them. A shopper
   * who has decided had to add, find the basket, open it and then check out —
   * four steps to do the thing the page exists for. This is the same basket and
   * the same validation; it just does not stop to admire the toast.
   */
  const buyNow = () => {
    if (add()) router.push("/checkout");
  };

  return (
    <div className="space-y-6">
      {/* Option pickers (e.g. Size) */}
      {attributes.map((attr) => {
        if (attr.options.length === 0) return null;

        // Render color swatches for 'Color' attribute
        if (attr.name.toLowerCase() === 'color') {
          return (
            <div key={attr.name}>
              <p className="mb-2.5 text-[13px] text-shop-muted">
                Colour:{" "}
                <span className="font-semibold text-shop-ink">
                  {selected[attr.name] || "Select a colour"}
                </span>
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

        // Size and other text options render as labelled rounded chips.
        const isSize = ["size", "sizes", "shoe size"].includes(attr.name.toLowerCase());

        return (
          <div key={attr.name}>
            <div className="mb-2.5 flex items-baseline justify-between gap-4">
              <p className="text-[13px] text-shop-muted">
                {attr.name}:{" "}
                <span className="font-semibold text-shop-ink">
                  {selected[attr.name] ?? `Select a ${attr.name.toLowerCase()}`}
                </span>
              </p>
              {isSize && (
                <select
                  aria-label="Size system"
                  value={sizeSystem}
                  onChange={(event) => setSizeSystem(event.target.value)}
                  className="rounded-lg border border-shop-line bg-white px-2.5 py-1.5 text-[12px] text-shop-body focus:border-shop-ink focus:outline-none"
                >
                  {SIZE_SYSTEMS.map((system) => (
                    <option key={system}>{system}</option>
                  ))}
                </select>
              )}
            </div>

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
                    className={`relative min-w-[52px] rounded-lg border px-4 py-2.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:border-shop-hairline disabled:bg-shop-surface disabled:text-[#bbb] ${
                      active
                        ? "border-shop-primary bg-shop-primary-soft font-semibold text-shop-primary"
                        : "border-shop-line text-shop-body hover:border-shop-primary"
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
          </div>
        );
      })}

      {error && <p className="text-[13px] font-medium text-shop-error">{error}</p>}

      {/* Quantity stepper, then a full-width primary action — the Shopify order. */}
      <div ref={actionRef}>
        <p className="mb-2.5 text-[13px] text-shop-muted">Quantity</p>
        <div className="flex items-stretch gap-3">
          <div className="flex items-center rounded-lg border border-shop-line">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((n) => Math.max(1, n - 1))}
              disabled={quantity <= 1}
              className="flex h-12 w-11 items-center justify-center text-[19px] text-shop-body transition-colors hover:text-shop-ink disabled:text-[#c9c9c9]"
            >
              −
            </button>
            <span
              aria-live="polite"
              className="w-8 text-center text-[14px] font-semibold text-shop-ink"
            >
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((n) => Math.min(10, n + 1))}
              disabled={quantity >= 10}
              className="flex h-12 w-11 items-center justify-center text-[19px] text-shop-body transition-colors hover:text-shop-ink disabled:text-[#c9c9c9]"
            >
              +
            </button>
          </div>

          {/* ---- Save for later, and it actually saves ----
               This heart used to show a "Saved" toast and store nothing, so a
               shopper who saved something to come back for found an empty
               wishlist when they did. It writes to the same wishlist the tiles
               use now, and says "Saved" on the button so the state is visible. */}
          <button
            type="button"
            aria-pressed={saved}
            aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
            onClick={() => {
              toggleWishlist({
                productId: product.id,
                name: product.name,
                image: product.image,
                price: product.price,
              });
              if (!saved) notify("Saved — find it in your wishlist anytime", { image: product.image });
            }}
            className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-semibold transition-colors ${
              saved
                ? "border-shop-primary bg-shop-primary-soft text-shop-primary-ink"
                : "border-shop-line text-shop-body hover:border-shop-ink hover:text-shop-ink"
            }`}
          >
            <svg
              aria-hidden
              className="h-5 w-5"
              fill={saved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.6"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
            {saved ? "Saved" : "Save"}
          </button>
        </div>

        {/* ---- Two actions, side by side ----
             "Add to cart" keeps shopping; "Buy now" ends it. They are weighted
             to say so: the primary is the orange fill and carries the delivery
             promise as a second line, because the last thing a shopper wants
             before committing is to know when the thing arrives — putting it
             on the button answers it at the exact moment it is asked rather
             than in a panel further down.

             Both are full pills rather than the 8px rectangles used elsewhere.
             A pill reads as the terminal action on the page, and having the two
             of them match keeps the pair legible as one choice with two
             answers. */}
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={add}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-shop-ink bg-white px-6 text-[15px] font-bold text-shop-ink transition-colors hover:bg-shop-ink hover:text-white"
          >
            <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 11h11.2L21 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
            </svg>
            Add to cart
          </button>
          <button
            type="button"
            onClick={buyNow}
            className="btn-shop min-h-[52px] flex-1 !flex-col !gap-0 !rounded-xl px-6 py-2 text-center leading-tight"
          >
            <span className="block text-[15px] font-bold">Buy now</span>
            {/* Full white, not white/90. White on the brand orange is already
                only 2.9:1 (see the palette note in globals.css); dimming it
                further to look "secondary" would have put the smallest text on
                the page at the worst contrast on the page. */}
            <span className="block text-[11px] font-medium text-white">
              Fastest delivery: 1 business day
            </span>
          </button>
        </div>
      </div>

      {/* Sticky buy bar. Sits above the mobile tab bar and reuses `add`, so the
          same option validation applies as the main button. */}
      <div
        aria-hidden={actionVisible}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-shop-line bg-white transition-transform duration-300 lg:bottom-0 ${
          actionVisible ? "pointer-events-none translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="mx-auto flex max-w-[var(--shell)] items-center gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8">
          <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-shop-line bg-white sm:block">
            {/* Guarded: an imageless product stores "" here, and `next/image`
                treats an empty src as a request for the current page. */}
            {product.image && (
              <Image src={product.image} alt="" fill sizes="48px" className="object-contain p-1" quality={90} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[12px] font-normal text-shop-ink">{product.name}</p>
            <p className="text-[13px] text-shop-muted">{formatPrice(product.price)}</p>
          </div>
          <button
            type="button"
            tabIndex={actionVisible ? -1 : 0}
            onClick={add}
            className="btn-shop shrink-0 px-6 py-3 text-[13px] md:px-10"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
