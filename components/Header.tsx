"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import type { ProductCategory } from "@/lib/woocommerce";
import SearchBar from "@/components/SearchBar";

export default function Header({ categories = [] }: { categories?: ProductCategory[] }) {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f8f7f4]">
      {/* Top bar */}
      <div className="border-b border-black/10 bg-[#181818] text-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-2 md:px-8">
          <span className="text-[10px] uppercase tracking-[0.16em]">Kandi Uganda</span>
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.12em]">
            <a href="https://shop.kandiug.com/my-account/" target="_blank" rel="noopener noreferrer" className="hover:underline hidden sm:inline">My Account</a>
            <span className="hidden sm:inline">|</span>
            <a href="#kandi-app" className="hover:underline">Download App</a>
            <span className="hidden sm:inline">|</span>
            <span>Buyer Protection</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-4 md:px-8 md:py-5">
        {/* Logo */}
        <Link href="/" className="shrink-0 font-heading text-2xl font-semibold tracking-[-0.08em] text-black md:text-3xl">
          KANDI<span className="text-[#a13b2a]">.</span>
        </Link>

        {/* Search */}
        <SearchBar />

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-3 md:gap-5">
          {/* Wishlist */}
          <Link href="/#wishlist" className="hidden sm:flex flex-col items-center gap-0.5 text-gray-600 hover:text-market transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
            <span className="text-[10px] font-medium">Wishlist</span>
          </Link>

          {/* Cart */}
          <Link href="/cart" className="relative flex flex-col items-center gap-0.5 text-gray-600 hover:text-market transition-colors" aria-label="Cart">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            <span className="text-[10px] font-medium hidden sm:inline">Cart</span>
            {count > 0 && (
              <span className="absolute -right-2 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-market px-1 text-[9px] font-bold text-white">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Category nav */}
      <nav className="bg-[#f8f7f4]">
        <div className="mx-auto flex max-w-[1440px] items-center gap-5 overflow-x-auto px-4 md:px-8 no-scrollbar">
          <Link href="/" className="shrink-0 whitespace-nowrap py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-black border-b border-black">
            New in
          </Link>
          {categories.slice(0, 8).map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="shrink-0 whitespace-nowrap py-3 text-[10px] uppercase tracking-[0.14em] text-gray-600 hover:text-black transition-colors"
            >
              {cat.name}
            </Link>
          ))}
          <Link
            href="/sale"
            className="ml-auto shrink-0 whitespace-nowrap py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a13b2a]"
          >
            🔥 Flash Deals
          </Link>
        </div>
      </nav>
    </header>
  );
}
