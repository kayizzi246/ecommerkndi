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
      <main className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-xl p-12">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
          <h1 className="text-xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-sm text-gray-500 mb-8">
            Discover our latest arrivals and find something you love.
          </p>
          <Link
            href="/"
            className="inline-block bg-market text-white text-sm font-bold px-10 py-3.5 rounded-lg hover:bg-market-dark transition-colors"
          >
            Start shopping
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 pb-24 lg:pb-8">
      {/* Breadcrumbs */}
      <nav className="text-xs text-gray-500 mb-5">
        <Link href="/" className="hover:text-market">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-800 font-medium">Shopping Cart</span>
      </nav>

      <h1 className="text-xl md:text-2xl font-bold mb-6">
        Shopping Cart ({count} {count === 1 ? "item" : "items"})
      </h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] items-start">
        {/* Cart items */}
        <div className="bg-white rounded-xl divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.key} className="flex gap-4 p-4 md:p-5">
              {/* Image */}
              <Link
                href={`/products/${item.productId}`}
                className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 bg-[#f6f6f6] rounded-lg overflow-hidden"
              >
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="96px"
                  className="object-contain p-2"
                />
              </Link>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/products/${item.productId}`}
                      className="text-sm font-semibold hover:text-market line-clamp-2 transition-colors"
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
                    <p className="text-sm font-bold text-market mt-1">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeItem(item.key);
                      notify("Item removed");
                    }}
                    className="text-gray-400 hover:text-market transition-colors shrink-0"
                    aria-label="Remove item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Quantity + subtotal row */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-gray-200 rounded-lg">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.key, item.quantity - 1)}
                      className="px-3 py-1.5 hover:bg-gray-50 text-sm font-medium transition-colors"
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span className="px-4 py-1.5 text-sm font-semibold min-w-[2rem] text-center border-x border-gray-200">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      className="px-3 py-1.5 hover:bg-gray-50 text-sm font-medium transition-colors"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                  <p className="font-bold text-sm">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary sidebar */}
        <aside className="bg-white rounded-xl p-5 lg:sticky lg:top-32">
          <h2 className="text-sm font-bold border-b border-gray-100 pb-3 mb-4">
            Order Summary
          </h2>

          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery</span>
              <span className="text-fresh font-medium">Free</span>
            </div>
          </div>

          <div className="flex justify-between border-t border-gray-100 pt-3 mb-6">
            <span className="font-bold">Total</span>
            <span className="font-bold text-lg">{formatPrice(subtotal)}</span>
          </div>

          <Link
            href="/checkout"
            className="block text-center bg-market text-white text-sm font-bold py-3.5 rounded-lg hover:bg-market-dark transition-colors"
          >
            Proceed to checkout
          </Link>

          <Link
            href="/"
            className="block text-center text-xs text-gray-500 hover:text-market mt-4 transition-colors"
          >
            ← Continue shopping
          </Link>

          {/* Payment methods */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">
              We accept
            </p>
            <div className="flex gap-2 text-xs text-gray-600">
              <span className="bg-gray-100 px-2 py-1 rounded">Cash</span>
              <span className="bg-gray-100 px-2 py-1 rounded">MTN MoMo</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Airtel Money</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Visa</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
