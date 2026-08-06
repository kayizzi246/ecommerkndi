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

/** The size run Brands For Less prints above the brand name on every PLP tile. */
function sizeRun(product: Product): string[] {
  const sizeAttr = product.attributes?.find((attr) =>
    ["size", "sizes", "shoe size"].includes(attr.name.toLowerCase())
  );
  return (sizeAttr?.options ?? []).map((option) => option.name).slice(0, 7);
}

export default function ProductCard({ product }: { product: Product }) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const brand = product.categories[0]?.name ?? "Kandi";
  const sizes = sizeRun(product);

  return (
    <Link href={`/products/${product.id}`} className="group block bg-white">
      {/* Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-bfl-surface">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 20vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />

        {isNew(product) && (
          <span className="absolute bottom-0 left-0 bg-bfl-green px-3 py-1 text-[11px] font-bold uppercase text-white">
            New
          </span>
        )}
        {product.stock_status === "outofstock" && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-bold uppercase tracking-wider text-black">
            Sold out
          </span>
        )}

        <div className="absolute right-2 top-2">
          <WishlistButton
            productId={product.id}
            name={product.name}
            image={product.image}
            price={product.price}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 hover:bg-white"
            iconClassName="w-4 h-4"
          />
        </div>
      </div>

      {/* Copy block */}
      <div className="pb-4 pt-2.5">
        {sizes.length > 0 && (
          <p className="truncate text-[11px] text-bfl-grey">{sizes.join("  |  ")}</p>
        )}

        <p className="mt-1 truncate text-[13px] font-bold text-black">{brand}</p>

        <h3 className="mt-0.5 line-clamp-2 min-h-[2.6rem] text-[13px] leading-snug text-[#4a4a4a]">
          {product.name}
        </h3>

        <p className="mt-1.5 text-[15px] font-bold text-black">{formatPrice(product.price)}</p>

        {discount > 0 && (
          <p className="mt-0.5 text-[11px] text-bfl-grey">
            RRP: <span className="line-through">{formatPrice(product.regular_price)}</span>{" "}
            <span className="font-bold text-bfl-red">({discount}% OFF)</span>
          </p>
        )}
      </div>
    </Link>
  );
}
