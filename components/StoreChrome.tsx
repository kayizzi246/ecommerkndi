"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CategoryNode } from "@/lib/woocommerce";
import type { SiteSettings } from "@/lib/site-settings";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import ShopperOnboarding from "@/components/ShopperOnboarding";
import CartDrawer from "@/components/CartDrawer";
import CookieNotice from "@/components/CookieNotice";
import ContactRail from "@/components/ContactRail";

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
          <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-4 md:px-8">
            <Link
              href="/cart"
              className="flex items-center gap-1.5 text-[14px] text-shop-body transition-colors hover:text-shop-ink"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to cart
            </Link>
            {/* The brand from wp-admin, not the literal "Kandi For Less" that
                used to be typed here. A shop that renames itself in settings
                would have kept the old name on the one page where a shopper is
                about to hand over money — which is the worst possible place for
                the storefront to look like a different business. */}
            <Link href="/" className="ml-auto text-[18px] font-semibold text-shop-ink">
              {settings.brand.name}{" "}
              <span className="font-normal">{settings.brand.suffix}</span>
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
      {/* Mounted here rather than in the layout so it inherits this component's
          one rule about where chrome belongs: the Seller Centre, admin and
          checkout return early above, and none of them should carry a shopper
          support rail over their own interface. */}
      <ContactRail support={settings.support} />
      <CartDrawer />
      <Footer settings={settings} departments={departments} />
      {/* The sliding "Create account" bar that used to sit here is gone with the
          rest of the site's banners. The cookie notice stays: it is a legal
          notice rather than a promotion, and it is the thing AppBanner used to
          have to queue behind — so nothing now stacks two bars along the foot
          of a phone screen. Account creation is still one tap away in the
          masthead and the bottom nav. */}
      <CookieNotice />
      <MobileBottomNav />
      <ShopperOnboarding departments={departments} />
    </>
  );
}
