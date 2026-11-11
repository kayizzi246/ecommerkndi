import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent, hasPriceReduction } from "@/lib/currency";
import WishlistButton from "@/components/WishlistButton";
import TileCartButton from "@/components/TileCartButton";
import { GRID_SIZES } from "@/lib/product-grid";

/** Stock at or under this shows "Only N left". */
const LOW_STOCK_AT = 5;
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
 * The product tile, kept clean: a square photo with square corners, one line
 * of name, the price with the sold count and the cart button, and the old
 * price under it. One flag on the photo at most (sold out, the discount, or
 * new), and one note only when stock is out or nearly out. Ratings, badges and
 * the delivery promise live on the product page, not on every tile.
 *
 * Styled by the `pc-*` classes in app/product-cards.css.
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
  const isNew = listedRecently(product.date_created);

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
                <s>{formatPrice(product.regular_price)}</s>
              </p>
            )}
          </div>
          <div className="pc-cart">
            <TileCartButton product={product} />
          </div>
        </div>

        {soldOut ? (
          <p className="pc-note">Back in stock soon</p>
        ) : lowStock ? (
          <p className="pc-urgent">Only {product.stock_quantity} left</p>
        ) : null}
      </div>

      {/* The whole tile is a pointer target. An overlay rather than an anchor
          around the article, so the wishlist and cart buttons are not nested
          inside a link. Hidden from assistive tech: the name is the real link. */}
      <Link href={href} aria-hidden tabIndex={-1} className="pc-overlay" />
    </article>
  );
}
