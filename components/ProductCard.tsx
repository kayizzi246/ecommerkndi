import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import WishlistButton from "@/components/WishlistButton";
import TileOffers from "@/components/TileOffers";
import TileCartButton from "@/components/TileCartButton";

const GRID_SIZES = "(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, (max-width: 1279px) 20vw, (max-width: 1720px) 17vw, 276px";

/** One card and one price hierarchy for all catalogue grids and carousels. */
export default function ProductCard({ product, priority = false, sizes = GRID_SIZES }: {
  product: Product;
  priority?: boolean;
  sizes?: string;
}) {
  const discount = discountPercent(product.regular_price, product.price);
  const reduced = product.regular_price > product.price && product.price > 0;
  const soldOut = product.stock_status === "outofstock";
  const lowStock = !soldOut && product.stock_quantity !== null && product.stock_quantity > 0 && product.stock_quantity <= 5;
  const href = `/products/${product.slug || product.id}`;
  const badge = product.total_sales >= 50 ? "Best seller"
    : product.rating_count >= 3 && product.average_rating >= 4.5 ? "Top rated" : null;

  return (
    <article className={`store-product-card tile-card group relative flex h-full flex-col ${reduced && !soldOut ? "tile-deal" : ""}`}>
      <div className="store-card-photo">
        <Link href={href} tabIndex={-1} aria-hidden className="store-card-image-link">
          {product.image ? <Image src={product.image} alt={product.name} fill sizes={sizes} priority={priority} className="store-card-image" />
            : <span className="store-card-no-image">Image coming soon</span>}
        </Link>
        {soldOut ? <span className="store-card-badge">Sold out</span>
          : reduced ? <span className="store-card-badge store-card-badge-sale">{discount > 0 ? `-${discount}%` : "Sale"}</span>
          : badge ? <span className="store-card-badge">{badge}</span> : null}
        <div className="store-card-wishlist relative z-20">
          <WishlistButton productId={product.id} name={product.name} image={product.image} price={product.price}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-shop-body ring-1 ring-black/10 hover:text-shop-primary" iconClassName="h-4 w-4" />
        </div>
      </div>
      <div className="store-card-body">
        <Link href={href} className="store-card-title-link"><h3 className="store-card-title">{product.name}</h3></Link>
        <div className="store-card-pricing">
          <p className="store-card-price">{formatPrice(product.price)}</p>
          <div className="store-card-original">
            {reduced && <><span className="sr-only">Original price: </span><s>{formatPrice(product.regular_price)}</s><span className="store-card-saving">Save {formatPrice(product.regular_price - product.price)}</span></>}
          </div>
        </div>
        <div className="store-card-meta">
          {product.rating_count > 0 ? <span className="store-card-reviews" aria-label={`Rated ${product.average_rating.toFixed(1)} out of 5 from ${product.rating_count} reviews`}><TileStars rating={product.average_rating} /><span>({product.rating_count})</span></span> : <span>View details</span>}
          {product.total_sales > 0 && <span>{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(product.total_sales)} sold</span>}
        </div>
        <div className="store-card-delivery">{soldOut ? <span>Back in stock soon</span> : <TileOffers price={product.price} />}</div>
        <div className="store-card-action relative z-20"><TileCartButton product={product} variant="pill" /></div>
        <p className="store-card-stock">{lowStock ? `Only ${product.stock_quantity} left` : "\u00a0"}</p>
      </div>
      <Link href={href} aria-hidden tabIndex={-1} className="absolute inset-0 z-10" />
    </article>
  );
}

const STAR_PATH =
  "M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5Z";

/**
 * Five stars filled to the rating, the way the Temu tile prints them: a grey
 * row with a dark row laid over it and cut to the rating's share of the width,
 * so a 4.6 shows four stars and most of a fifth. No gradient ids, which would
 * collide with every other tile on the page.
 */
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
