"use client";

import { usePathname } from "next/navigation";
import type { CategoryNode } from "@/lib/woocommerce";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppBanner from "@/components/AppBanner";
import MobileBottomNav from "@/components/MobileBottomNav";
import ShopperOnboarding from "@/components/ShopperOnboarding";

/**
 * The Seller Centre is a separate application surface with its own sidebar
 * chrome, so the storefront masthead, footer and onboarding are suppressed on
 * every /seller route.
 */
export default function StoreChrome({
  departments,
  children,
}: {
  departments: CategoryNode[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSellerArea = pathname === "/seller" || pathname.startsWith("/seller/");

  if (isSellerArea) {
    return <>{children}</>;
  }

  return (
    <>
      <Header departments={departments} />
      <div className="flex-1">{children}</div>
      <Footer />
      <AppBanner />
      <MobileBottomNav />
      <ShopperOnboarding departments={departments} />
    </>
  );
}
