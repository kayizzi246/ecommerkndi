"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCustomerSession } from "@/lib/customer-session";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useState } from "react";

const NAV = [
  { href: "/account", label: "Overview", icon: "grid" },
  { href: "/account/orders", label: "My orders", icon: "box" },
  { href: "/account/reviews", label: "My reviews", icon: "star" },
  { href: "/account/wishlist", label: "Wishlist", icon: "heart" },
  { href: "/account/settings", label: "Settings", icon: "cog" },
] as const;

/**
 * Shell for the shopper's dashboard: a sidebar of sections beside the active
 * page, and a sign-in wall in front of the whole area.
 *
 * The guard is client-side because the session lives in an httpOnly cookie the
 * browser trades for a customer through `/api/auth/me`; every endpoint behind
 * these pages checks the same cookie server-side, so this is presentation, not
 * the security boundary.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { customer, loading, refresh, signOut } = useCustomerSession();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-16 md:px-8">
        <div className="h-64 animate-skeleton rounded-2xl bg-shop-hairline" />
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="mx-auto max-w-[520px] px-4 py-16 md:px-8">
        <div className="rounded-2xl border border-shop-line bg-white p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-shop-primary-soft text-shop-primary">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="3.75" />
              <path strokeLinecap="round" d="M4.5 20.1a7.5 7.5 0 0 1 15 0" />
            </svg>
          </span>
          <h1 className="mt-4 text-[24px] font-extrabold text-shop-ink">Your Kandi account</h1>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-shop-muted">
            Sign in with Google to track orders, manage your wishlist, review what you have
            bought and check out faster.
          </p>

          <div className="mt-6 flex justify-center">
            <GoogleSignInButton
              endpoint="/api/auth/google"
              onSuccess={refresh}
              onError={setError}
              text="signin_with"
              width={300}
            />
          </div>

          {error && (
            <p role="alert" className="mt-4 text-[14px] text-shop-sale">
              {error}
            </p>
          )}

          <p className="mt-6 border-t border-shop-line pt-4 text-[14px] text-shop-muted">
            Selling with us?{" "}
            <Link href="/seller/login" className="font-semibold text-shop-primary hover:underline">
              Seller Centre
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 md:px-8 lg:pb-16">
      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside>
          <div className="flex items-center gap-3 rounded-2xl border border-shop-line bg-white p-4">
            {customer.avatar ? (
              <Image
                src={customer.avatar}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-shop-primary-soft text-[19px] font-semibold text-shop-primary">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold text-shop-ink">{customer.name}</p>
              <p className="truncate text-[13px] text-shop-muted">{customer.email}</p>
            </div>
          </div>

          {/* Horizontal tabs on small screens, a stacked list from lg up. */}
          <nav className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-shop-line bg-white p-2 no-scrollbar lg:flex-col lg:overflow-visible">
            {NAV.map((item) => {
              const active =
                item.href === "/account"
                  ? pathname === "/account"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold transition-colors ${
                    active
                      ? "bg-shop-primary-soft text-shop-primary"
                      : "text-shop-body hover:bg-shop-hairline hover:text-shop-ink"
                  }`}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={signOut}
            className="btn-shop-outline mt-4 w-full py-2.5 text-[15px]"
          >
            Sign out
          </button>
        </aside>

        <div>{children}</div>
      </div>
    </main>
  );
}

function NavIcon({ name }: { name: (typeof NAV)[number]["icon"] }) {
  const common = {
    className: "h-[19px] w-[19px] shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    viewBox: "0 0 24 24",
  } as const;

  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4V5Zm10 0h6v6h-6V5ZM4 13h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18m8-13.5-8 4.5-8-4.5" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m12 4 2.4 5 5.6.7-4 3.9 1 5.4-5-2.7-5 2.7 1-5.4-4-3.9 5.6-.7L12 4Z" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
        </svg>
      );
    case "cog":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
        </svg>
      );
  }
}
