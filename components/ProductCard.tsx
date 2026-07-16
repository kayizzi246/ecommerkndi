import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";

const NEW_WINDOW_DAYS = 30;

function isNew(product: Product): boolean {
  if (!product.date_created) return false;
  const created = new Date(product.date_created).getTime();
  return Date.now() - created < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export default function ProductCard({ product }: { product: Product }) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const brand = product.categories[0]?.name ?? "Kandi";
  const sizes =
    (product.attributes ?? []).find((a) => /size/i.test(a.name))?.options ?? [];

  return (
    <Link href={`/products/${product.id}`} className="group block bg-white">
      <div className="relative w-full aspect-square bg-[#f5f5f5] overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
        />
        {isNew(product) && (
          <span className="absolute bottom-0 left-0 bg-fresh text-white text-xs font-bold uppercase px-3 py-1">
            New
          </span>
        )}
        {product.stock_status === "outofstock" && (
          <span className="absolute top-2 left-2 bg-gray-800 text-white text-xs font-semibold px-2 py-0.5">
            Sold out
          </span>
        )}
        {product.stock_status === "instock" &&
          product.stock_quantity !== null &&
          product.stock_quantity <= 5 && (
            <span className="absolute top-2 left-2 bg-sale text-white text-xs font-semibold px-2 py-0.5">
              Only {product.stock_quantity} left
            </span>
          )}
      </div>
      <div className="pt-2.5 pb-1">
        {/* Sizes row, like Brands For Less */}
        <p className="text-xs text-gray-400 min-h-4 mb-1">
          {sizes.slice(0, 7).map((size, i) => (
            <span key={size}>
              {i > 0 && <span className="mx-1.5 text-gray-300">|</span>}
              {size}
            </span>
          ))}
        </p>
        <p className="font-heading text-[15px] font-bold">{brand}</p>
        <h3 className="text-sm text-gray-500 line-clamp-2 min-h-10 mt-0.5">
          {product.name}
        </h3>
        <p className="font-heading text-lg font-bold mt-1">
          {formatPrice(product.price)}
        </p>
        {discount > 0 && (
          <p className="text-xs mt-0.5">
            <span className="text-gray-400">
              RRP: {formatPrice(product.regular_price)}
            </span>{" "}
            <span className="text-sale font-bold">({discount}% OFF)</span>
          </p>
        )}
      </div>
    </Link>
  );
}
