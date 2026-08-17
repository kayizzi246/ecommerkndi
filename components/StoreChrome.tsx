"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CategoryNode } from "@/lib/woocommerce";
import type { SiteSettings } from "@/lib/site-settings";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
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
      {/* ---- The content sheet: white, on an off-white page ----
       *
       * `--background` is #f9fafb and every storefront page's content now sits
       * on a white column centred in it, so the tint only ever shows in the
       * gutters left and right of the content.
       *
       * That is the whole reason the page ground went off-white. A tint behind
       * the CONTENT was the arrangement this shop tried twice and abandoned
       * twice, because most of this catalogue is photographed on white and a
       * tinted ground puts every product in a faintly visible grey box. A tint
       * OUTSIDE the content has none of that problem: no product ever touches
       * it. What it buys is that the shop reads as a sheet of merchandise on a
       * surface rather than as text floating on the browser's own white, which
       * is the difference between a storefront and a document.
       *
       * ---- The thing to know before judging this on your own screen ----
       *
       * The sheet is 1600px wide, which is the width the product grid has
       * always used. So on any display narrower than that — every laptop, every
       * tablet, every phone — the sheet fills the viewport and there are NO
       * off-white gutters to see. The effect appears on wide desktop monitors
       * and nowhere else.
       *
       * If the gutters should be visible on a laptop too, the lever is this
       * `max-w-[1600px]`, and narrowing it takes width away from the product
       * grid on exactly the screens that have the most room for products. That
       * is a merchandising trade, not a styling one, which is why it has not
       * been made here unilaterally.
       *
       * The hairline borders are what keep the sheet legible as a sheet when it
       * IS narrower than the viewport — a 2% tint alone is too subtle to read
       * as an edge, and an edge is the point. */}
      <div className="flex-1">
        <div className="mx-auto w-full max-w-[1600px] border-shop-line bg-white min-[1600px]:border-x">
          {children}
        </div>
      </div>
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
      {/* ---- The welcome flow is gone, and this is why ----

          `<ShopperOnboarding />` used to render here: a full-screen modal that
          appeared 1.2 seconds after load for every first-time visitor, asked
          for departments, a clothing size and a city, and set
          `document.body.style.overflow = "hidden"` while it was up.

          It was the single most expensive thing on the site. A shopper arriving
          from Google — which is nearly all of them, on a phone, on a Ugandan
          connection — waited for the page, started to read it, and then had it
          taken away and replaced with three questions from a shop they had not
          decided to trust yet. The answers bought very little: a size that most
          departments here have no use for, and a city that the delivery quote
          asks for again at checkout because it needs a real address anyway.

          It also blocked the one thing the page is for. The first product photo
          was behind it, scrolling was locked, and the way out was a dismissal
          the visitor had to find.

          The component file stays — `readShopperPreferences` is still imported
          by DeliveryPromise, and returns null now, which that component already
          handles by falling back to the shop's own default. Nothing renders the
          flow, so nothing asks. */}
    </>
  );
}
