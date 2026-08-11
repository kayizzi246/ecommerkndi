"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/currency";
import type { Product } from "@/lib/woocommerce";

export type SheetIntent = "cart" | "buy";

/**
 * The choices a product needs before it can go in the bag, as a bottom sheet.
 *
 * The sticky bar sits at the bottom of a long page, which is exactly where the
 * decision gets made and nowhere near the size and colour pickers. Sending the
 * shopper back up to find them loses people — they came to buy and were handed
 * a scroll. Adding a default variant instead would be worse: the wrong size
 * costs a return, a refund and the customer.
 *
 * So the choices come to the thumb. A product with nothing to choose never sees
 * this sheet at all — it goes straight into the bag.
 */
export default function VariantSheet({
  product,
  intent,
  onClose,
}: {
  product: Product;
  /** `null` keeps the sheet closed; the value decides where "confirm" leads. */
  intent: SheetIntent | null;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const { notify } = useToast();
  const router = useRouter();

  const attributes = (product.attributes ?? []).filter((attr) => attr.options.length > 0);

  const [selected, setSelected] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    attributes.forEach((attr) => (initial[attr.name] = null));
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const open = intent !== null;

  // Escape closes it, and the page behind stops scrolling while it is open —
  // a sheet you can scroll the page underneath feels broken on a phone.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  /**
   * Whether an option can still be bought given what is already chosen.
   *
   * A variable product usually has gaps — the red one exists, but not in 42 —
   * and offering a combination that cannot be fulfilled produces an order the
   * seller has to cancel.
   */
  const available = (attrName: string, optionName: string) => {
    if (!product.variations || product.variations.length === 0) return true;

    return product.variations.some((variation) => {
      if (!variation.is_in_stock) return false;
      if (variation.attributes[attrName] !== optionName) return false;

      return Object.entries(selected).every(([name, value]) => {
        if (!value || name === attrName) return true;
        return variation.attributes[name] === value;
      });
    });
  };

  const confirm = () => {
    const missing = attributes.find((attr) => !selected[attr.name]);
    if (missing) {
      setError(`Please choose a ${missing.name.toLowerCase()}.`);
      return;
    }

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

    if (intent === "buy") {
      // Straight to checkout. A "Buy now" that drops somebody on the cart page
      // has added a step, not removed one.
      router.push("/checkout");
      return;
    }

    notify("Added to cart", { image: product.image, showBagLink: true });
    onClose();
  };

  return (
    /* Not `lg:hidden`. The desktop sticky bar opens this too once the buy box
       has scrolled away, and hiding it there would leave that button doing
       nothing at all — the sheet would mount, be invisible, and swallow the
       click. It simply stops being full width on a large screen. */
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Choose options">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/40"
      />

      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] sm:max-w-[440px] sm:rounded-2xl lg:bottom-8">
        {/* Grab handle. Purely a signal, but it is the signal every phone user
            already reads as "this panel pulls down". */}
        <div className="sticky top-0 flex justify-center bg-white pb-1 pt-2.5">
          <span aria-hidden className="h-1 w-10 rounded-full bg-shop-line" />
        </div>

        <div className="flex items-center gap-3 px-4 pb-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-shop-hairline">
            {product.image && (
              <Image src={product.image} alt="" fill sizes="64px" className="object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="price text-[19px] leading-none text-shop-flame">
              {formatPrice(product.price)}
            </p>
            <p className="mt-1 line-clamp-2 text-[13.5px] text-shop-title">{product.name}</p>
          </div>
        </div>

        <div className="space-y-5 px-4">
          {attributes.map((attr) => (
            <div key={attr.name}>
              <p className="mb-2.5 text-[14px] text-shop-muted">
                {attr.name}:{" "}
                <span className="font-semibold text-shop-ink">
                  {selected[attr.name] ?? `Choose a ${attr.name.toLowerCase()}`}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {attr.options.map((option) => {
                  const isSelected = selected[attr.name] === option.name;
                  const canBuy = available(attr.name, option.name);

                  return (
                    <button
                      key={option.name}
                      type="button"
                      disabled={!canBuy}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelected((prev) => ({ ...prev, [attr.name]: option.name }));
                        setError(null);
                      }}
                      className={`min-w-11 rounded-xl border px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
                        isSelected
                          ? "border-shop-ink bg-shop-ink text-white"
                          : canBuy
                            ? "border-shop-line text-shop-body hover:border-shop-ink"
                            : /* Struck through rather than hidden: knowing the
                                 size exists but is gone is useful information,
                                 and a vanishing option reads as a bug. */
                              "border-shop-line text-shop-faint line-through opacity-60"
                      }`}
                    >
                      {option.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <span className="text-[14px] text-shop-muted">Quantity</span>
            <div className="flex items-center gap-1 rounded-xl border border-shop-line">
              <button
                type="button"
                aria-label="Fewer"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="px-4 py-2 text-[18px] leading-none text-shop-body"
              >
                −
              </button>
              <span className="min-w-8 text-center text-[15px] font-semibold text-shop-ink">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="More"
                onClick={() => setQuantity((value) => value + 1)}
                className="px-4 py-2 text-[18px] leading-none text-shop-body"
              >
                +
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-[14px] font-semibold text-shop-sale">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 mt-5 border-t border-shop-line bg-white px-4 py-3">
          <button type="button" onClick={confirm} className="btn-shop w-full py-3.5 text-[15px]">
            {intent === "buy" ? "Buy now" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
