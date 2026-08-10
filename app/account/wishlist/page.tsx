"use client";

import Link from "next/link";
import Image from "next/image";
import { useWishlist } from "@/lib/wishlist";
import { formatPrice } from "@/lib/currency";

/**
 * Saved items. The wishlist lives in the browser rather than on the account,
 * so it is labelled as such — it is per-device, not per-login.
 */
export default function AccountWishlist() {
  const { items, remove } = useWishlist();

  return (
    <div>
      <h1 className="text-[21px] font-extrabold leading-tight text-shop-ink">Wishlist</h1>
      <p className="mt-1 text-[15px] text-shop-muted">
        Saved on this device — {items.length} {items.length === 1 ? "item" : "items"}.
      </p>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-shop-line bg-white p-10 text-center">
          <p className="text-[16px] text-shop-muted">Nothing saved yet.</p>
          <Link href="/" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex gap-4 rounded-2xl border border-shop-line bg-white p-4"
            >
              <Link
                href={`/products/${item.productId}`}
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-shop-hairline"
              >
                {item.image && (
                  <Image src={item.image} alt="" fill sizes="96px" className="object-cover" />
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/products/${item.productId}`}
                  className="line-clamp-2 text-[15px] text-shop-body hover:text-shop-ink"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-[19px] font-semibold text-shop-ink">
                  {formatPrice(item.price)}
                </p>
                <button
                  type="button"
                  onClick={() => remove(item.productId)}
                  className="mt-auto self-start text-[14px] font-semibold text-shop-muted hover:text-shop-sale"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
