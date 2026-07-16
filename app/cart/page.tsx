"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import { formatPrice } from "@/lib/currency";

export default function CartPage() {
  const { items, count, subtotal, updateQuantity, removeItem } = useCart();
  const { notify } = useToast();

  if (items.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-24 text-center">
        <h1 className="text-xl tracking-[0.3em] uppercase font-semibold mb-3">
          Your bag is empty
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Discover our latest arrivals and find something you love.
        </p>
        <Link
          href="/"
          className="inline-block bg-black text-white text-xs tracking-[0.25em] uppercase px-10 py-4 hover:bg-gray-800 transition-colors"
        >
          Start shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      <h1 className="text-xl md:text-2xl tracking-[0.3em] uppercase font-semibold mb-10">
        Shopping Bag ({count})
      </h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px] items-start">
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {items.map((item) => (
            <div key={item.key} className="flex gap-5 py-6">
              <Link
                href={`/products/${item.productId}`}
                className="relative w-28 h-28 shrink-0 bg-[#f6f6f6]"
              >
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="112px"
                  className="object-contain p-2"
                />
              </Link>

              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${item.productId}`}
                  className="text-sm font-medium hover:underline underline-offset-4 line-clamp-2"
                >
                  {item.name}
                </Link>
                {item.options && Object.keys(item.options).length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Object.entries(item.options)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                )}
                <p className="text-sm font-semibold mt-1">
                  {formatPrice(item.price)}
                </p>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center border border-gray-300">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.key, item.quantity - 1)
                      }
                      className="px-3 py-1 hover:bg-gray-100"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="px-4 text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.key, item.quantity + 1)
                      }
                      className="px-3 py-1 hover:bg-gray-100"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeItem(item.key);
                      notify("Removed from bag");
                    }}
                    className="text-[11px] tracking-[0.2em] uppercase text-gray-500 hover:text-black underline underline-offset-4"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <p className="font-semibold whitespace-nowrap hidden sm:block">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <aside className="border border-gray-200 p-6 lg:sticky lg:top-40">
          <h2 className="text-sm tracking-[0.25em] uppercase font-semibold border-b border-gray-200 pb-4 mb-4">
            Summary
          </h2>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Subtotal ({count} items)</span>
            <span className="font-semibold">{formatPrice(subtotal)}</span>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            Delivery arranged after we confirm your order by phone.
          </p>
          <Link
            href="/checkout"
            className="block text-center bg-black text-white text-xs tracking-[0.25em] uppercase py-4 hover:bg-gray-800 transition-colors"
          >
            Checkout
          </Link>
          <Link
            href="/"
            className="block text-center text-[11px] tracking-[0.2em] uppercase mt-4 underline underline-offset-8 hover:opacity-60"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}
