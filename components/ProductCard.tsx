import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent, hasPriceReduction } from "@/lib/currency";
import WishlistButton from "@/components/WishlistButton";
import TileCartButton from "@/components/TileCartButton";

/** Stock at or under this shows "Only N left". */
const LOW_STOCK_AT = 5;
/** Lifetime units sold before a product is called a best seller. */
const BEST_SELLER_AT = 50;
const TOP_RATED_AT = 4.5;
const TOP_RATED_REVIEWS = 3;
/** Days a listing counts as new. */
const NEW_FOR_DAYS = 14;

function listedRecently(dateCreated: string | null | undefined): boolean {
  if (!dateCreated) return false;
  const listedAt = Date.parse(dateCreated);
  return Number.isFinite(listedAt) && Date.now() - listedAt < NEW_FOR_DAYS * 86_400_000;
}

/** 1234 → "1.2K", the way the sold count reads on a marketplace tile. */
function compactSold(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

/**
 * How wide a tile renders at each breakpoint, so the browser fetches a photo
 * the right size. Follows `PRODUCT_GRID` (2 → 3 → 4 → 5 → 6 columns) and must
 * change with it.
 */
const GRID_SIZES =
  "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 260px";

/**
 * The product tile, laid out the way Temu lays out theirs: a square photo, one
 * line of name, the price with the sold count beside it and the cart button to
 * the right, the old price underneath, then one merchandising line, the stars
 * and the delivery promise.
 *
 * Styled by the `pc-*` classes in app/product-cards.css rather than the older
 * `tile-*` rules in globals.css, which had been overridden in so many places
 * that changing one of them no longer reliably changed the tile.
 */
export default function ProductCard({
  product,
  priority = false,
  sizes = GRID_SIZES,
}: {
  product: Product;
  priority?: boolean;
  sizes?: string;
}) {
  const reduced = hasPriceReduction(product.regular_price, product.price);
  const discount = discountPercent(product.regular_price, product.price);
  const soldOut = product.stock_status === "outofstock";
  const lowStock =
    !soldOut && product.stock_quantity !== null && product.stock_quantity > 0 && product.stock_quantity <= LOW_STOCK_AT;
  const href = `/products/${product.slug || product.id}`;

  const bestSeller = product.total_sales >= BEST_SELLER_AT;
  const topRated =
    product.rating_count >= TOP_RATED_REVIEWS && product.average_rating >= TOP_RATED_AT;
  const isNew = listedRecently(product.date_created);

  /* One merchandising line under the price, only when it says something
     the tile does not already: the discount is on the flag and the struck
     price, and "New" is on the flag, so neither is repeated here. */
  const highlight = bestSeller ? "Best-selling item" : topRated ? "Top rated item" : null;

  const secondPhoto = product.gallery.find((url) => url && url !== product.image) ?? null;

  return (
    <article className={`pc group ${soldOut ? "pc-soldout" : ""}`}>
      <div className="pc-photo">
        <Link href={href} tabIndex={-1} aria-hidden className="pc-photo-link">
          {product.image ? (
            <>
              <Image
                quality={90}
                src={product.image}
                alt={product.name}
                fill
                sizes={sizes}
                {...(priority
                  ? { loading: "eager" as const, fetchPriority: "high" as const }
                  : { loading: "lazy" as const })}
                className={`pc-img ${secondPhoto ? "pc-img-swap" : ""}`}
              />
              {/* The second shot on hover: the back of the garment, the sole of
                  the shoe — answered without opening the page. */}
              {secondPhoto && (
                <Image
                  quality={90}
                  src={secondPhoto}
                  alt=""
                  aria-hidden
                  fill
                  sizes={sizes}
                  loading="lazy"
                  className="pc-img pc-img-alt"
                />
              )}
            </>
          ) : (
            <span className="pc-noimg">No image</span>
          )}
        </Link>

        {soldOut ? (
          <span className="pc-flag pc-flag-dark">Sold out</span>
        ) : discount > 0 ? (
          <span className="pc-flag pc-flag-sale">-{discount}%</span>
        ) : isNew ? (
          <span className="pc-flag pc-flag-new">New</span>
        ) : null}

        {/* The campaign mark on reduced products: a small tag in the corner
            of the photo rather than a ribbon across it. */}
        {/* Only on the deepest cuts: a sticker on every reduced photo stopped
            meaning anything and made the grid look stamped out. */}
        {!soldOut && discount >= 40 && (
          <span className="pc-bn-tag" aria-hidden>
            Black November
          </span>
        )}


        {/* `z-20` lifts both controls above the whole-card link at the foot of
            this component, so they act instead of navigating. */}
        <div className="pc-wish">
          <WishlistButton
            productId={product.id}
            name={product.name}
            image={product.image}
            price={product.price}
            className="h-8 w-8 rounded-full bg-white/95 text-[#222] shadow-sm ring-1 ring-black/5 hover:text-shop-price-was"
            iconClassName="h-[17px] w-[17px]"
          />
        </div>
      </div>

      <div className="pc-body">
        <Link href={href} className="pc-name-link">
          <h3 className="pc-name">{product.name}</h3>
        </Link>

        <div className="pc-buy">
          <div className="min-w-0 flex-1">
            <p className="pc-price-row">
              <span className={`pc-price ${reduced ? "pc-price-deal" : ""}`}>
                {formatPrice(product.price)}
              </span>
              {product.total_sales > 0 && (
                <span className="pc-sold">
                  {compactSold(product.total_sales)}
                  {product.total_sales >= 1000 ? "+" : ""} sold
                </span>
              )}
            </p>
            {reduced && (
              <p className="pc-was">
                Was: <s>{formatPrice(product.regular_price)}</s>
              </p>
            )}
          </div>
          <div className="pc-cart">
            <TileCartButton product={product} />
          </div>
        </div>

        {highlight && !soldOut && <p className="pc-highlight">{highlight}</p>}

        {product.rating_count > 0 && (
          <p
            className="pc-rating"
            aria-label={`Rated ${product.average_rating.toFixed(1)} of 5 from ${product.rating_count} reviews`}
          >
            <TileStars rating={product.average_rating} />
            <span aria-hidden>{product.rating_count.toLocaleString("en-US")}</span>
          </p>
        )}

        {soldOut ? (
          <p className="pc-note">Back in stock soon</p>
        ) : lowStock ? (
          <p className="pc-urgent">Only {product.stock_quantity} left</p>
        ) : (
          <p className="pc-delivery">
            {/* The shop's Kampala express promise. Upcountry orders still take
                the 1–3 business days stated on the product and delivery pages,
                which is why the place is named. */}
            Arrives in <strong>90 mins</strong> · Kampala
          </p>
        )}
      </div>

      {/* The whole tile is a pointer target. An overlay rather than an anchor
          around the article, so the wishlist and cart buttons are not nested
          inside a link. Hidden from assistive tech: the name is the real link. */}
      <Link href={href} aria-hidden tabIndex={-1} className="pc-overlay" />
    </article>
  );
}

const STAR_PATH =
  "M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5Z";

/** Five stars filled to the rating, black on grey. */
function TileStars({ rating }: { rating: number }) {
  const row = (className: string) => (
    <span className={`flex gap-px ${className}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
  const share = Math.max(0, Math.min(5, rating)) / 5;
  return (
    <span aria-hidden className="relative inline-flex">
      {row("text-[#d4d4d4]")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${share * 100}%` }}>
        {row("text-[#222222]")}
      </span>
    </span>
  );
}
