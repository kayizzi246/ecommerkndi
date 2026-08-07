import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import WishlistButton from "@/components/WishlistButton";

const NEW_WINDOW_DAYS = 30;

function isNew(product: Product): boolean {
  if (!product.date_created) return false;
  const created = new Date(product.date_created).getTime();
  return Date.now() - created < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Product tile, following the Next.js Commerce grid tile: a square white frame
 * with a bordered edge that picks up the accent on hover, the whole product
 * shown with `object-contain` (never cropped), and a rounded label plate
 * floating over the bottom edge carrying the title and a price pill.
 */
export default function ProductCard({ product }: { product: Product }) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const soldOut = product.stock_status === "outofstock";

  return (
    <div className="group relative h-full">
      <Link
        href={`/products/${product.id}`}
        className="relative flex aspect-square h-full w-full items-center justify-center overflow-hidden rounded-lg border border-shop-line bg-white transition-colors hover:border-shop-ink"
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`relative h-full w-full object-contain p-2 transition duration-300 ease-in-out group-hover:scale-105 ${
            soldOut ? "opacity-60" : ""
          }`}
        />

        {/* Flags */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {discount > 0 && (
            <span className="rounded-full bg-shop-sale px-2.5 py-1 text-[11px] font-semibold text-white">
              −{discount}%
            </span>
          )}
          {isNew(product) && discount === 0 && (
            <span className="rounded-full bg-shop-ink px-2.5 py-1 text-[11px] font-semibold text-white">
              New in
            </span>
          )}
          {soldOut && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-shop-ink backdrop-blur-md">
              Sold out
            </span>
          )}
        </div>

        {/* Label plate */}
        <div className="absolute bottom-0 left-0 flex w-full px-3 pb-3">
          <div className="flex w-full items-center rounded-full border border-shop-line bg-white/70 p-1 text-[12px] font-semibold text-shop-ink backdrop-blur-md">
            <h3 className="mr-3 line-clamp-2 grow pl-2.5 leading-none tracking-tight">
              {product.name}
            </h3>
            <span className="flex flex-none items-baseline gap-1.5 rounded-full bg-shop-ink px-3 py-2 text-white">
              {formatPrice(product.price)}
              {discount > 0 && (
                <span className="text-[10px] font-normal text-white/60 line-through">
                  {formatPrice(product.regular_price)}
                </span>
              )}
            </span>
          </div>
        </div>
      </Link>

      {/* Wishlist sits outside the link so the heart never navigates. */}
      <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <WishlistButton
          productId={product.id}
          name={product.name}
          image={product.image}
          price={product.price}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-shop-line bg-white/80 text-shop-ink backdrop-blur-md transition-colors hover:bg-white"
          iconClassName="w-[18px] h-[18px]"
        />
      </div>
    </div>
  );
}
