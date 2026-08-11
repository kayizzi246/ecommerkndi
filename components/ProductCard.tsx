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
 * white and the detail beneath it is tight, so a grid of forty reads as a
 * catalogue rather than forty floating panels. Whitespace separates.
 *
 * The order is the one every large marketplace has converged on, and it is an
 * order of decreasing importance rather than a description of the product:
 *
 *   image → name → price, was-price and discount on one line →
 *   rating and units sold → the delivery promise.
 *
 * The price leads the text because it is what a shopper scans a grid for. It is
 * set large and bold, with the struck-through original and the saving beside it
 * rather than on a line of their own — the three numbers only mean anything
 * read together, and splitting them costs a line of vertical space in a tile
 * that has none to spare.
 *
 * Colour is rationed: the resting price is near-black and only a discounted one
 * turns red, so red still means something; green is delivery and nothing else.
 *
 * Every figure comes from WooCommerce, and each line disappears when there is no
 * number behind it rather than printing a zero.
 */
export default function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  /**
   * Load this card's photo immediately rather than lazily.
   *
   * Set only on the handful of cards that are already on screen when the page
   * opens. A lazy image is not requested until the browser has finished laying
   * the page out, which on a phone puts the shop's largest paint — the first
   * product photo — several hundred milliseconds behind where it could be. Off
   * by default: making every card eager would have them all compete for
   * bandwidth and would be slower than doing nothing.
   */
  priority?: boolean;
}) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const soldOut = product.stock_status === "outofstock";
  const lowStock =
    !soldOut && product.stock_quantity !== null && product.stock_quantity <= LOW_STOCK_AT;

  // Readable URLs — /products/blue-running-shoes, not /products/190.
  const href = `/products/${product.slug || product.id}`;
  const category = product.categories[0];

  /** The back view, when the seller uploaded one. */
  const secondPhoto = product.gallery.find((url) => url && url !== product.image) ?? null;

  /** Money off in shillings, which lands harder than a percentage. */
  const saving = discount > 0 ? product.regular_price - product.price : 0;

  /**
   * The sizes or colours this product comes in.
   *
   * A shopper's second question, after "what does the back look like", is
   * "will it fit me" — and a tile that answers it saves a click for the people
   * it fits and saves a wasted one for the people it does not.
   */
  const options = product.attributes[0]?.options ?? [];
  const swatches = options.slice(0, 4);
  const moreOptions = Math.max(0, options.length - swatches.length);

  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-transparent p-0.5 transition-colors hover:border-shop-line sm:p-1">
      {/* ---- Image ---- */}
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          {/* 4:5 rather than square. Clothes and shoes are photographed
              standing up, and a square crop of a portrait shot spends its
              height on floor and ceiling — the extra 25% goes to the garment,
              which on a phone is most of what the shopper can see at all. */}
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-shop-hairline">
            {product.image ? (
              <>
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 20vw, 17vw"
                  {...(priority ? { priority: true } : { loading: "lazy" as const })}
                  className={`object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02] ${
                    soldOut ? "opacity-50" : ""
                  } ${secondPhoto ? "group-hover:opacity-0" : ""}`}
                />

                {/* The second photograph, revealed on hover.
                    A shopper's first question about a garment is what the other
                    side looks like, and answering it without a page load is the
                    single most effective thing a tile can do. Only rendered when
                    the product genuinely has a second shot — a "hover" that
                    shows the same picture again reads as a glitch. */}
                {secondPhoto && (
                  <Image
                    src={secondPhoto}
                    alt=""
                    aria-hidden
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 20vw, 17vw"
                    loading="lazy"
                    className="object-cover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                  />
                )}
              </>
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
        {/* The discount used to be stamped across the photograph as a 56px
            orange medallion. It now lives beside the price instead: the saving
            is a number to read next to the two other numbers it relates to, and
            forty medallions across a grid covered forty products with the same
            piece of orange. The photographs are the point of the page. */}

        {/* The reference card carries no heart, so it appears on hover — and on
            focus, so it stays reachable from the keyboard. Wishlisting is real
            functionality here; hiding it entirely would remove a feature to
            match a screenshot. */}
        <div className="absolute left-2 top-2 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <WishlistButton
            productId={product.id}
            name={product.name}
            image={product.image}
            price={product.price}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-shop-body shadow-sm backdrop-blur-sm transition-colors hover:text-shop-primary"
            iconClassName="w-[16px] h-[16px]"
          />
        </div>

        {/* Add-to-bag rides the corner of the photograph rather than sitting in
            the text below it. It buys back a whole line of the tile, and it is
            where a thumb already is after tapping the picture. */}
        <div className="absolute bottom-2 right-2 rounded-full bg-white/95 shadow-sm backdrop-blur-sm">
          <TileCartButton product={product} />
        </div>
      </div>

      {/* ---- Detail ----
           Tight on purpose: every pixel between these five short lines is a
           pixel of photograph the next row does not get. */}
      <div className="mt-1.5 flex flex-1 flex-col gap-1">
        {/* Chips run inline with the name, so a tag costs no vertical space. */}
        <Link href={href} className="block">
          {/* 14/20 rather than 14/19: a supplier title always wraps to the full
              two lines, and a tight leading is felt most exactly where the text
              is longest. */}
          <h3 className="font-normal-heading line-clamp-2 text-[14px] leading-[20px] text-shop-ink transition-colors hover:text-shop-primary">
            <span className="mr-1 inline-block rounded-[3px] border border-shop-success/50 px-1 align-[1px] text-[10px] font-semibold text-shop-success">
              Local
            </span>
            {product.name}
          </h3>
        </Link>

        {/* The money, all on one line: what it costs, what it cost, what that
            saves. A discounted price turns red — the one place red is allowed —
            because at a glance the colour is the discount. */}
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span
            className={`price text-[19px] leading-none ${
              discount > 0 ? "text-shop-sale" : "text-shop-ink"
            }`}
          >
            {formatPrice(product.price)}
          </span>
          {discount > 0 && (
            <>
              <span className="text-[12.5px] leading-none text-shop-faint line-through">
                {formatPrice(product.regular_price)}
              </span>
              <span className="text-[12.5px] font-bold leading-none text-shop-sale">
                −{discount}%
              </span>
            </>
          )}
        </p>

        {/* What the discount is worth in money. "−17%" is arithmetic a shopper
            has to do; "Save UGX 5,000" is the answer. */}
        {saving > 0 && (
          <p className="text-[12.5px] font-semibold leading-none text-shop-success">
            Save {formatPrice(saving)}
          </p>
        )}

        {/* Rating and units sold on one line — the two numbers a shopper uses to
            decide whether anyone else has taken the risk first. */}
        {(product.rating_count > 0 || product.total_sales > 0) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {product.rating_count > 0 && (
              <span className="flex items-center gap-1">
                <Stars rating={product.average_rating} />
                <span className="text-[12.5px] font-semibold text-shop-body">
                  {product.average_rating.toFixed(1)}
                </span>
              </span>
            )}
            {product.total_sales > 0 && (
              <span className="text-[12.5px] font-medium text-shop-muted">
                {compactSold(product.total_sales)} sold
              </span>
            )}
          </div>
        )}

        {/* Sizes or colours, straight from the product's own attributes.
            Colour options that carry a hex value are drawn as dots; everything
            else is set as text, because "38 · 39 · 40" tells a shopper more
            than four identical grey circles would. */}
        {swatches.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {swatches.map((option) =>
              option.value && option.value.startsWith("#") ? (
                <span
                  key={option.name}
                  title={option.name}
                  className="h-3.5 w-3.5 rounded-full border border-shop-line"
                  style={{ backgroundColor: option.value }}
                />
              ) : (
                <span
                  key={option.name}
                  className="rounded border border-shop-line px-1 py-px text-[11px] leading-none text-shop-body"
                >
                  {option.name}
                </span>
              )
            )}
            {moreOptions > 0 && (
              <span className="text-[11px] leading-none text-shop-muted">+{moreOptions}</span>
            )}
          </div>
        )}

        {/* One promotional line, earned from real figures rather than pasted on
            every card. Orange is reserved for this. */}
        {!soldOut && product.total_sales >= 50 && category ? (
          <p className="truncate text-[12.5px] font-medium text-shop-primary">
            Best Seller <span className="font-normal text-shop-body">in {category.name}</span>
          </p>
        ) : !soldOut && isNew(product) && category ? (
          <p className="truncate text-[12.5px] font-medium text-shop-primary">
            New Arrival <span className="font-normal text-shop-body">in {category.name}</span>
          </p>
        ) : null}

        <p className="mt-auto pt-0.5 text-[12.5px] font-medium text-shop-success">
          {soldOut ? (
            "Back in stock soon"
          ) : lowStock ? (
            <span className="flex items-center gap-1.5 text-shop-sale">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-shop-sale" aria-hidden />
              Only {product.stock_quantity} left
            </span>
          ) : (
            /* Not "free delivery" — that depends on the basket total, and a tile
               cannot know it. Promising it here would be a lie on most orders. */
            "Fastest delivery: 1 business day"
          )}
        </p>
      </div>
    </article>
  );
}
