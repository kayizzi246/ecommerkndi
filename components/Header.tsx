"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import type { ProductCategory } from "@/lib/woocommerce";
import SearchBar from "@/components/SearchBar";

export default function Header({
  categories = [],
}: {
  categories?: ProductCategory[];
}) {
  const { count } = useCart();
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  // Hide the header while scrolling down; slide it back the moment the
  // user scrolls up (Brands For Less behavior).
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y <= 80) {
        setVisible(true);
      } else if (y > lastY.current + 4) {
        setVisible(false);
      } else if (y < lastY.current - 4) {
        setVisible(true);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 bg-white shadow-sm transition-transform duration-300 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {/* Top row: logo, search, actions */}
      <div className="max-w-7xl mx-auto flex items-center gap-4 md:gap-8 px-4 md:px-8 py-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="bg-sun rounded-md w-9 h-9 flex items-center justify-center text-lg">
            🛍️
          </span>
          <span className="font-heading text-xl md:text-2xl font-bold tracking-wide">
            Kandi Store
          </span>
        </Link>

        <SearchBar />

        <nav className="flex items-center gap-4 md:gap-6 shrink-0">
          <a
            href="#kandi-app"
            className="hidden lg:flex items-center gap-2 text-xs text-gray-600 hover:text-black"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
              />
            </svg>
            Download our app
          </a>
          <a
            href="https://acculifepharma.co.ug/my-account/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center text-gray-700 hover:text-black"
            aria-label="My account"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a8.25 8.25 0 0 1 15 0"
              />
            </svg>
          </a>
          <Link
            href="/cart"
            className="relative flex items-center text-gray-700 hover:text-black"
            aria-label="Cart"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
              />
            </svg>
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-sale text-white text-[10px] font-bold rounded-full min-w-4.5 h-4.5 flex items-center justify-center px-1">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* Black category nav */}
      <nav className="bg-black text-white overflow-x-auto">
        <ul className="max-w-7xl mx-auto flex items-center gap-1 px-4 md:px-8 whitespace-nowrap">
          <li>
            <Link
              href="/"
              className="block px-3 py-3 text-sm font-semibold hover:text-sun"
            >
              ⚡ New Arrivals
            </Link>
          </li>
          {categories.slice(0, 7).map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/category/${cat.slug}`}
                className="block px-3 py-3 text-sm font-medium hover:text-sun"
              >
                {cat.name}
              </Link>
            </li>
          ))}
          <li className="ml-auto">
            <Link
              href="/sale"
              className="relative block bg-sale px-5 py-3 text-sm font-bold italic"
              style={{ clipPath: "polygon(6% 0, 100% 0, 94% 100%, 0 100%)" }}
            >
              Super Price Store
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
