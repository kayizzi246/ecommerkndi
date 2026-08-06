"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import type { CategoryNode } from "@/lib/woocommerce";
import SearchBar from "@/components/SearchBar";
import MegaMenu from "@/components/MegaMenu";
import AccountMenu from "@/components/AccountMenu";

/**
 * Brands For Less style masthead: a white utility row (logo, pill search, app
 * link, market switcher) above the black department bar, which ends in the
 * angled red promo tab and the account cluster.
 */
export default function Header({ departments = [] }: { departments?: CategoryNode[] }) {
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white">
      {/* ---- Utility row ---- */}
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 md:gap-8 md:px-8 md:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-bfl-yellow">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8Z" />
              <path strokeLinecap="round" d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
            </svg>
          </span>
          <span className="font-heading text-lg font-bold leading-none tracking-tight text-bfl-ink md:text-xl">
            Kandi<span className="text-black"> For Less</span>
          </span>
        </Link>

        <SearchBar />

        <a
          href="#kandi-app"
          className="hidden shrink-0 items-center gap-2 text-[13px] text-[#333] hover:text-black lg:flex"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
            <rect x="7" y="2.5" width="10" height="19" rx="2" />
            <path strokeLinecap="round" d="M10.5 18.5h3" />
          </svg>
          Download our mobile app
        </a>

        <button
          type="button"
          className="hidden shrink-0 items-center gap-1.5 text-[13px] text-[#333] hover:text-black md:flex"
        >
          <span className="text-base leading-none">🇺🇬</span>
          <span>UG | UGX</span>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="shrink-0 text-black lg:hidden"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {/* ---- Department bar ---- */}
      <nav className="bg-black text-white">
        <div className="mx-auto flex max-w-[1440px] items-stretch px-4 md:px-8">
          <Link
            href="/"
            className="mr-1 flex shrink-0 items-center gap-2 whitespace-nowrap py-3 text-[13px] font-bold text-bfl-yellow"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 7h16M4 12h12M4 17h16" />
            </svg>
            New Arrivals
          </Link>

          <div className="min-w-0 flex-1">
            <MegaMenu departments={departments} />
          </div>

          <Link
            href="/sale"
            className="nav-slant ml-2 flex shrink-0 items-center whitespace-nowrap bg-bfl-red px-6 py-3 text-[13px] font-bold text-white"
          >
            Super Price Store
          </Link>

          <div className="flex shrink-0 items-center gap-5 pl-6">
            <Link
              href="/sellers"
              className="hidden items-center gap-2 text-[13px] text-white/90 hover:text-bfl-yellow xl:flex"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4V5Zm10 0h6v6h-6V5ZM4 13h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
              </svg>
              Shop by store
            </Link>

            <AccountMenu />

            <Link href="/#wishlist" aria-label="Wishlist" className="hidden text-white hover:text-bfl-yellow sm:block">
              <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </Link>

            <Link href="/cart" aria-label="Cart" className="relative text-white hover:text-bfl-yellow">
              <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h2.2l2 10.5h11.1L20 9H6.2" />
                <circle cx="9" cy="20" r="1.2" />
                <circle cx="17.5" cy="20" r="1.2" />
              </svg>
              {count > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bfl-red px-1 text-[10px] font-bold text-white">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </nav>

      {/* ---- Mobile drawer ---- */}
      {menuOpen && (
        <div className="max-h-[70vh] overflow-y-auto border-b border-bfl-line bg-white lg:hidden">
          <ul className="mx-auto max-w-[1440px] px-4 py-2">
            {departments.map((department) => (
              <li key={department.id} className="border-b border-bfl-line">
                {department.children.length > 0 ? (
                  <details>
                    <summary className="flex cursor-pointer items-center justify-between py-3 text-[14px] font-bold text-black">
                      {department.name}
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <ul className="pb-2 pl-3">
                      <li>
                        <Link
                          href={`/category/${department.slug}`}
                          onClick={() => setMenuOpen(false)}
                          className="block py-2 text-[13px] font-bold text-bfl-red"
                        >
                          All {department.name}
                        </Link>
                      </li>
                      {department.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={`/category/${child.slug}`}
                            onClick={() => setMenuOpen(false)}
                            className="block py-2 text-[13px] text-[#333]"
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <Link
                    href={`/category/${department.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="block py-3 text-[14px] font-bold text-black"
                  >
                    {department.name}
                  </Link>
                )}
              </li>
            ))}
            <li>
              <Link
                href="/seller"
                onClick={() => setMenuOpen(false)}
                className="block py-3 text-[14px] font-bold text-bfl-ink"
              >
                Seller Centre
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
