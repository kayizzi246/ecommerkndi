"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSellerSession } from "@/lib/seller-session";

/** Routes inside /seller that must render without the authenticated chrome. */
const PUBLIC_ROUTES = ["/seller/login", "/seller/register"];

const NAV = [
  { href: "/seller", label: "Overview", exact: true, icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" },
  { href: "/seller/products", label: "Products", icon: "M4 7l8-3.5L20 7v10l-8 3.5L4 17V7Zm8 3.5L4 7m8 3.5L20 7m-8 3.5V20" },
  { href: "/seller/orders", label: "Orders & sales", icon: "M3 6h2.2l2 10.5h11.1L20 9H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8.5 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" },
  { href: "/seller/commissions", label: "Commissions", icon: "M12 3v18M8 7h6.5a2.5 2.5 0 0 1 0 5H9.5a2.5 2.5 0 0 0 0 5H16" },
  { href: "/seller/settings", label: "Store settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.4-3a8.4 8.4 0 0 0-.13-1.45l2-1.55-2-3.46-2.35.95a8.5 8.5 0 0 0-2.5-1.45L15 2.5H9l-.42 2.54a8.5 8.5 0 0 0-2.5 1.45L3.73 5.54l-2 3.46 2 1.55a8.5 8.5 0 0 0 0 2.9l-2 1.55 2 3.46 2.35-.95a8.5 8.5 0 0 0 2.5 1.45L9 21.5h6l.42-2.54a8.5 8.5 0 0 0 2.5-1.45l2.35.95 2-3.46-2-1.55c.09-.48.13-.96.13-1.45Z" },
];

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-[#e7f7ea] text-[#0a7a2f]" },
  pending: { label: "Pending review", className: "bg-[#fff6dd] text-[#8a6100]" },
  suspended: { label: "Suspended", className: "bg-[#fdeaea] text-[#a51f1f]" },
  rejected: { label: "Rejected", className: "bg-[#fdeaea] text-[#a51f1f]" },
};

export default function SellerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { seller, loading, signOut } = useSellerSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  // Bounce unauthenticated visitors to the sign-in screen.
  useEffect(() => {
    if (!isPublic && !loading && !seller) {
      router.replace("/seller/login");
    }
  }, [isPublic, loading, seller, router]);

  if (isPublic) {
    return <div className="min-h-screen bg-bfl-surface">{children}</div>;
  }

  if (loading || !seller) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bfl-surface text-sm text-bfl-grey">
        Loading your Seller Centre…
      </div>
    );
  }

  const status = STATUS_COPY[seller.status] ?? STATUS_COPY.pending;

  return (
    <div className="min-h-screen bg-bfl-surface">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 bg-black px-4 text-white md:px-6">
        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-label="Toggle navigation"
          className="lg:hidden"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <Link href="/seller" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-bfl-yellow text-black">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8Z" />
              <path strokeLinecap="round" d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
            </svg>
          </span>
          <span className="text-[15px] font-bold">Seller Centre</span>
        </Link>

        <div className="ml-auto flex items-center gap-4">
          <Link href="/" className="hidden text-[13px] text-white/80 hover:text-bfl-yellow sm:block">
            View storefront
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-[13px] font-bold leading-tight">{seller.store_name}</p>
            <p className="text-[11px] leading-tight text-white/60">{seller.email}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded border border-white/25 px-3 py-1.5 text-[12px] font-bold hover:border-bfl-yellow hover:text-bfl-yellow"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-14 left-0 z-30 w-60 shrink-0 border-r border-bfl-line bg-white transition-transform lg:static lg:inset-auto lg:translate-x-0 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="border-b border-bfl-line px-4 py-4">
            <p className="text-[11px] uppercase tracking-wide text-bfl-grey">Store status</p>
            <span className={`mt-1.5 inline-block rounded px-2 py-1 text-[12px] font-bold ${status.className}`}>
              {status.label}
            </span>
            <p className="mt-2 text-[12px] text-bfl-grey">
              Commission rate <span className="font-bold text-black">{seller.commission_rate}%</span>
            </p>
          </div>

          <nav className="p-2">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`mb-0.5 flex items-center gap-3 rounded px-3 py-2.5 text-[13px] transition-colors ${
                    active
                      ? "bg-bfl-yellow font-bold text-black"
                      : "text-[#333] hover:bg-bfl-surface"
                  }`}
                >
                  <svg className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mx-2 mt-2 rounded border border-bfl-line bg-bfl-surface p-3">
            <p className="text-[12px] font-bold text-black">Add a new product</p>
            <p className="mt-1 text-[11px] leading-4 text-bfl-grey">
              Listings go live once our team approves them.
            </p>
            <Link
              href="/seller/products/new"
              onClick={() => setDrawerOpen(false)}
              className="btn-bfl mt-3 block rounded py-2 text-center text-[12px]"
            >
              New listing
            </Link>
          </div>
        </aside>

        {drawerOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 top-14 z-20 cursor-default bg-black/40 lg:hidden"
          />
        )}

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
