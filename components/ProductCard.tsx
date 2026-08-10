import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import WishlistButton from "@/components/WishlistButton";
import TileCartButton from "@/components/TileCartButton";

/** At or below this many units, the card says how few are left. */
const LOW_STOCK_AT = 5;

/** A product counts as new for this long after it was created. */
const NEW_WINDOW_DAYS = 30;

function isNew(product: Product): boolean {
  if (!product.date_created) return false;
  return Date.now() - new Date(product.date_created).getTime() < NEW_WINDOW_DAYS * 86_400_000;
}

/** "2.2K sold" — the compact form marketplaces print beside a price. */
function compactSold(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

/**
 * Five dark stars, filled to the rating.
 *
 * Dark rather than gold: on a card this dense the stars are a measurement, not
 * a decoration, and a row of gold pulls the eye off the price sitting directly
 * above it. Half-steps are rounded to the nearest whole star — at 11px a half
 * star is indistinguishable from a full one anyway.
 */
function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating);

  return (
    <span className="flex items-center gap-[1px]" aria-label={`Rated ${rating.toFixed(1)} of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          aria-hidden
          className={`h-[11px] w-[11px] ${index < filled ? "text-shop-ink" : "text-shop-line"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5Z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * The one product card the whole store uses — every grid, rail and carousel.
 *
 * Chrome-free: no border, no shadow, no card background. The photograph sits on
 * the page and the detail beneath it is small and tight, so a grid of forty
 * reads as a catalogue rather than forty floating panels. Whitespace separates.
 *
 * The order is the dense-marketplace one:
 *
 *   image → tag chips inline with a one-line name → price, sold count, cart →
 *   why-this-product → stars and review count → the delivery promise.
 *
 * The name is deliberately one line. Supplier titles run to ninety characters of
 * keyword soup; two lines of it pushes the price down and tells a shopper
 * nothing the first six words did not.
 *
 * Colour is rationed: the resting price is near-black and only a discounted one
 * turns red, so red still means something; orange marks the one promotional
 * line; green is delivery and nothing else.
 *
 * Every figure comes from WooCommerce, and each line disappears when there is no
 * number behind it rather than printing a zero.
 */
export default function ProductCard({ product }: { product: Product }) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const soldOut = product.stock_status === "outofstock";
  const lowStock =
    !soldOut && product.stock_quantity !== null && product.stock_quantity <= LOW_STOCK_AT;

  // Readable URLs — /products/blue-running-shoes, not /products/190.
  const href = `/products/${product.slug || product.id}`;
  const category = product.categories[0];

  return (
    <article className="group relative flex h-full flex-col">
      {/* ---- Image ---- */}
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-shop-hairline">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                loading="lazy"
                className={`object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02] ${
                  soldOut ? "opacity-50" : ""
                }`}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-shop-muted">
                <svg className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <circle cx="8.5" cy="10" r="1.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 3-2 4 3" />
                </svg>
                <span className="text-[12px]">No image</span>
              </div>
            )}
          </div>
        </Link>

        {soldOut && (
          <span className="absolute left-2 top-2 rounded bg-shop-ink px-2 py-0.5 text-[11px] font-semibold text-white">
            Sold out
          </span>
        )}

        {/* The reference card carries no heart, so it appears on hover — and on
            focus, so it stays reachable from the keyboard. Wishlisting is real
            functionality here; hiding it entirely would remove a feature to
            match a screenshot. */}
        <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <WishlistButton
            productId={product.id}
            name={product.name}
            image={product.image}
            price={product.price}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-shop-body shadow-sm backdrop-blur-sm transition-colors hover:text-shop-primary"
            iconClassName="w-[16px] h-[16px]"
          />
        </div>
      </div>

      {/* ---- Detail ---- */}
      <div className="mt-2 flex flex-1 flex-col gap-[5px]">
        {/* Chips run inline with the name, so a tag costs no vertical space. */}
        <Link href={href} className="block">
          <h3 className="font-normal-heading truncate text-[13px] leading-[18px] text-shop-ink transition-colors hover:text-shop-primary">
            {discount > 0 && (
              <span className="mr-1 inline-block rounded-[3px] bg-shop-sale px-1 align-[1px] text-[10px] font-bold text-white">
                Sale
              </span>
            )}
            <span className="mr-1 inline-block rounded-[3px] border border-shop-success/50 px-1 align-[1px] text-[10px] font-semibold text-shop-success">
              Local
            </span>
            {product.name}
          </h3>
        </Link>

        {/* Price, units sold and the action on one line. */}
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span
              className={`price text-[16px] leading-none ${
                discount > 0 ? "text-shop-sale" : "text-shop-ink"
              }`}
            >
              {formatPrice(product.price)}
            </span>
            {product.total_sales > 0 && (
              <span className="text-[12px] leading-none text-shop-muted">
                {compactSold(product.total_sales)} sold
              </span>
            )}
          </p>
          <TileCartButton product={product} />
        </div>

        {discount > 0 && (
          <p className="text-[12px] leading-tight text-shop-muted">
            Was: <span className="line-through">{formatPrice(product.regular_price)}</span>
          </p>
        )}

        {/* One promotional line, earned from real figures rather than pasted on
            every card. Orange is reserved for this. */}
        {!soldOut && product.total_sales >= 50 && category ? (
          <p className="truncate text-[12px] text-shop-primary">
            Best Seller <span className="text-shop-body">in {category.name}</span>
          </p>
        ) : !soldOut && isNew(product) && category ? (
          <p className="truncate text-[12px] text-shop-primary">
            New Arrival <span className="text-shop-body">in {category.name}</span>
          </p>
        ) : null}

        {product.rating_count > 0 && (
          <div className="flex items-center gap-1.5">
            <Stars rating={product.average_rating} />
            <span className="text-[12px] text-shop-ink">{product.rating_count}</span>
          </div>
        )}

        <p className="mt-auto pt-0.5 text-[12px] text-shop-success">
          {soldOut ? (
            "Back in stock soon"
          ) : lowStock ? (
            <span className="flex items-center gap-1.5 font-medium text-shop-sale">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-shop-sale" aria-hidden />
              Only {product.stock_quantity} left
            </span>
          ) : (
            "Fastest delivery: 1 business day"
          )}
        </p>
      </div>
    </article>
  );
}
