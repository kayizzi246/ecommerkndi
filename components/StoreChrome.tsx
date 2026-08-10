"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CategoryNode } from "@/lib/woocommerce";
import type { SiteSettings } from "@/lib/site-settings";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppBanner from "@/components/AppBanner";
import MobileBottomNav from "@/components/MobileBottomNav";
import ShopperOnboarding from "@/components/ShopperOnboarding";
import CartDrawer from "@/components/CartDrawer";

/**
 * The Seller Centre and the owner's product manager are separate application
 * surfaces with their own chrome, so the storefront masthead, footer and
 * onboarding are suppressed on every /seller and /admin route.
 *
 * Checkout is likewise chromeless — no nav, no footer, no promos — so the only
 * ways out are completing the order or the back link. That is how hosted
 * checkouts are built, and it is what keeps shoppers from wandering off mid-pay.
 */
export default function StoreChrome({
  departments,
  settings,
  children,
}: {
  departments: CategoryNode[];
  settings: SiteSettings;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAppArea =
    pathname === "/seller" ||
    pathname.startsWith("/seller/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (isAppArea) {
    return <>{children}</>;
  }

  if (pathname === "/checkout") {
    return (
      <>
        <header className="border-b border-shop-line bg-white">
          <div className="mx-auto flex max-w-[1450px] items-center gap-4 px-4 py-4 md:px-8">
            <Link
              href="/cart"
              className="flex items-center gap-1.5 text-[14px] text-shop-body transition-colors hover:text-shop-ink"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to cart
            </Link>
            <Link href="/" className="ml-auto text-[18px] font-semibold text-shop-ink">
              Kandi <span className="font-normal">For Less</span>
            </Link>
          </div>
        </header>
        {children}
      </>
    );
  }

  return (
    <>
      <Header departments={departments} settings={settings} />
      <div className="flex-1">{children}</div>
      <CartDrawer />
      <Footer settings={settings} />
      <AppBanner />
      <MobileBottomNav />
      <ShopperOnboarding departments={departments} />
    </>
  );
}
