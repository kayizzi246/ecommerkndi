import type { Metadata } from "next";
import Link from "next/link";
import OwnerSignOut from "./OwnerSignOut";

export const metadata: Metadata = {
  title: "Shop Admin",
  // The admin surface must never be indexed, even if someone links to it.
  robots: { index: false, follow: false },
};

/**
 * Chrome for the owner's product manager.
 *
 * Deliberately plain and dark: it is a back-office tool, and it should never be
 * mistaken for a page a shopper is meant to be looking at.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // Columns of prices and stock counts, so the neutral face rather than the
    // geometric one the storefront is set in.
    <div className="font-tabular flex min-h-screen flex-col bg-shop-surface">
      <header className="bg-shop-nav text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-4 py-3 md:px-8">
          <Link href="/admin/products" className="font-heading text-lg tracking-tight">
            Shop <span className="text-shop-flame">Admin</span>
          </Link>
          <nav className="flex items-center gap-5 text-[14px] font-semibold">
            <Link href="/admin/products" className="hover:text-bfl-yellow">
              Products
            </Link>
            <Link href="/" className="text-white/75 hover:text-bfl-yellow">
              View shop
            </Link>
          </nav>
          <OwnerSignOut />
        </div>
      </header>

      <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
