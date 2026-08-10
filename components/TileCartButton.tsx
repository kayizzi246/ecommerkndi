"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import type { Product } from "@/lib/woocommerce";

type Variant = "icon" | "bar" | "pill";

/**
 * Add-to-bag on a grid tile.
 *
 * Two shapes, one behaviour: `icon` is the small square button that sits beside
 * the price, `bar` is the full-width strip that slides up over the foot of the
 * image on hover. Both do the same thing, and both refuse the same thing — a
 * product with options (size, colour) cannot go in the bag from the grid,
 * because the shopper has not chosen them yet, so the control becomes a link to
 * the product page rather than silently adding the wrong variant.
 */
export default function TileCartButton({
  product,
  variant = "icon",
}: {
  product: Product;
  variant?: Variant;
}) {
  const { addItem } = useCart();
  const { notify } = useToast();

  const soldOut = product.stock_status === "outofstock";
  const needsOptions = (product.attributes ?? []).some(
    (attribute) => attribute.options.length > 0
  );

  // Three shapes, one behaviour:
  //   bar   — full-width strip, for a hover overlay across a photo
  //   pill  — the labelled ADD TO CART button on the closing row of a card
  //   icon  — a bare disc, where there is no room for a label
  const base =
    variant === "bar"
      ? "flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-bold transition-colors"
      : variant === "pill"
        ? "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors"
        // An outlined square beside the price. Quiet at rest so it does not
        // compete with forty others in a grid, orange on hover, and it presses
        // in on tap so the action is felt on a phone as well as seen.
        : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-150 active:scale-95";

  // Readable URLs — /products/blue-running-shoes, not /products/190.
  const href = `/products/${product.slug || product.id}`;

  const label = (idle: string) =>
    variant === "icon" ? (
      <CartIcon />
    ) : (
      <>
        {idle}
        {variant === "pill" && <CartIcon className="h-4 w-4" />}
      </>
    );

  if (soldOut) {
    return (
      <span aria-hidden className={`${base} cursor-not-allowed border-shop-line bg-shop-hairline text-shop-muted`}>
        {label("Sold out")}
      </span>
    );
  }

  const filled =
    variant === "bar"
      ? `${base} bg-shop-ink text-white hover:bg-shop-primary`
      : variant === "icon" ? `${base} border-shop-line bg-white text-shop-ink hover:border-shop-primary hover:text-shop-primary` : `${base} bg-shop-flame text-white hover:bg-shop-primary`;

  if (needsOptions) {
    return (
      <Link href={href} aria-label={`Choose options for ${product.name}`} className={filled}>
        {label("Choose")}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Add ${product.name} to cart`}
      onClick={() => {
        addItem(
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
          },
          1
        );
        notify("Added to cart", { image: product.image, showBagLink: true });
      }}
      className={filled}
    >
      {label("Add to cart")}
    </button>
  );
}

function CartIcon({ className = "h-[19px] w-[19px]" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h2.2l2 10.5h11.1L20 9H6.2" />
      <circle cx="9" cy="20" r="1.2" />
      <circle cx="17.5" cy="20" r="1.2" />
    </svg>
  );
}
