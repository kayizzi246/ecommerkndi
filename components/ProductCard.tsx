import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import StarRating from "@/components/StarRating";
import WishlistButton from "@/components/WishlistButton";

const NEW_WINDOW_DAYS = 30;

function isNew(product: Product): boolean {
  if (!product.date_created) return false;
  const created = new Date(product.date_created).getTime();
  return Date.now() - created < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

const SIMULATED_SOLD = [128, 95, 342, 67, 510, 43, 189, 256, 77, 312, 145, 88];

export default function ProductCard({ product }: { product: Product }) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const brand = product.categories[0]?.name ?? "Kandi";
  const simulatedSold = SIMULATED_SOLD[product.id % SIMULATED_SOLD.length];
  const simulatedRating =
    [4.5, 4.0, 4.8, 3.5, 5.0, 4.2, 4.6, 3.8][product.id % 8] || 4.3;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block overflow-hidden border border-transparent bg-transparent transition-transform hover:-translate-y-0.5"
    >
      {/* Image container */}
      <div className="relative w-full aspect-square overflow-hidden bg-[#efede8]">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 20vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {/* Badges */}
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-black text-white text-[9px] font-semibold px-2 py-1 uppercase tracking-wider">
            -{discount}%
          </span>
        )}
        {isNew(product) && (
          <span className="absolute top-2 right-2 bg-[#55705c] text-white text-[9px] font-semibold px-2 py-1 uppercase tracking-wider">
            NEW
          </span>
        )}
        {product.stock_status === "outofstock" && (
          <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold uppercase tracking-wider">
            Sold out
          </span>
        )}
        {/* Free shipping badge */}
        {product.price > 50000 && product.stock_status === "instock" && (
          <span className="absolute bottom-2 left-2 bg-[#55705c] text-white text-[9px] font-semibold px-2 py-1 uppercase tracking-wider">
            Free shipping
          </span>
        )}
        {/* Wishlist heart */}
        <div className="absolute top-2 right-2">
          <WishlistButton
            productId={product.id}
            name={product.name}
            image={product.image}
            price={product.price}
            className="w-7 h-7 bg-[#f8f7f4]/90 hover:bg-white rounded-full border border-black/10"
            iconClassName="w-3.5 h-3.5"
          />
        </div>
      </div>

      {/* Product info */}
      <div className="px-0 py-3">
        <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-[0.14em] truncate">
          {brand}
        </p>
        <h3 className="mt-1 text-sm leading-snug text-gray-900 line-clamp-2 min-h-[2.7rem]">
          {product.name}
        </h3>

        {/* Rating + sold */}
        <div className="mt-1.5 flex items-center gap-2">
          <StarRating rating={simulatedRating} size="sm" />
          <span className="text-[10px] text-gray-400">
            {simulatedSold > 999
              ? `${(simulatedSold / 1000).toFixed(1)}k`
              : simulatedSold}{" "}
            sold
          </span>
        </div>

        {/* Price */}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-heading text-base font-semibold text-black">
            {formatPrice(product.price)}
          </span>
          {discount > 0 && (
            <span className="text-[11px] text-gray-400 line-through">
              {formatPrice(product.regular_price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
