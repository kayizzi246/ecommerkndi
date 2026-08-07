import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";

const TONES = {
  orange: "text-pop-orange",
  red: "text-pop-red",
  green: "text-pop-green",
  blue: "text-pop-blue",
  violet: "text-pop-violet",
} as const;

export type DealTone = keyof typeof TONES;

/**
 * Compact deal tile for the homepage rails.
 *
 * Deliberately barer than {@link ProductCard}: a white image frame and a big
 * coloured price, so a rail of six reads as a price list you can scan rather
 * than six full product cards competing for attention.
 */
export default function DealTile({
  product,
  tone = "orange",
}: {
  product: Product;
  tone?: DealTone;
}) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;

  return (
    <Link href={`/products/${product.id}`} className="group block">
      {/* The product fills the frame edge to edge — only a hairline of padding,
          so the shot stays legible at rail size. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-shop-line bg-white">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 24vw, 16vw"
            className="object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          // Some listings reach us with no image at all; a neutral mark beats
          // the browser's broken-image icon.
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-shop-surface text-shop-muted">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.3" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 3-2 4 3" />
            </svg>
            <span className="text-[10px]">No image</span>
          </div>
        )}
        {discount > 0 && (
          <span className="absolute left-1.5 top-1.5 rounded bg-pop-red px-1.5 py-0.5 text-[10px] font-black text-white">
            -{discount}%
          </span>
        )}
      </div>

      <p className={`mt-2 text-[18px] font-black leading-none ${TONES[tone]}`}>
        {formatPrice(product.price)}
      </p>
      {discount > 0 && (
        <p className="mt-1 text-[11px] text-shop-muted">
          Was <span className="line-through">{formatPrice(product.regular_price)}</span>
        </p>
      )}
      <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-tight text-shop-body">
        {product.name}
      </p>
    </Link>
  );
}
