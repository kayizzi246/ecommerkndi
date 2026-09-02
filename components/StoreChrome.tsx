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
import { SellHeader, SellFooter } from "@/components/SellChrome";

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

  /**
   * ---- The shop page runs to the glass ----
   *
   * `--shell` is 1720px and `globals.css` argues at length for why — full
   * bleed was tried across the whole site and taken back out, because a
   * masthead and a homepage hero with no edges leave nothing saying where the
   * shop stops and the browser starts.
   *
   * The category listing is the one page where that argument does not hold.
   * It is not a composed page with a hero and eight rails; it is a grid whose
   * only job is to show as much of a department as fits, and a bounded shell
   * on a 2560px monitor is a column of seven tiles declining ~800px of room
   * that would carry more of them. It also has a filter rail eating 256px off
   * the left, so it starts narrower than every other page at the same shell.
   *
   * Done by overriding the token rather than by special-casing containers:
   * the masthead, the content column and the footer all read `--shell`, so one
   * declaration on a `display: contents` wrapper takes the whole page to the
   * window and keeps the three of them aligned with each other. Special-casing
   * the content column alone would have left the grid starting 32px in while
   * the logo above it started at 90px, which is worse than either width.
   *
   * The cost, and it is real: the masthead changes width when a shopper moves
   * between a category page and anything else. Judged the cheaper of the two —
   * a chrome that resizes on navigation is a moment, a grid misaligned with
   * the header above it is every second the page is open.
   */
  const isShopGrid = pathname.startsWith("/category/");

  if (isAppArea) {
    return <>{children}</>;
  }

  // ---- /sell is a marketing site, not a shop page ----
  //
  // It gets its own header and footer for the reasons written at the head of
  // `SellChrome`: its visitor is a prospective seller reading an argument, not
  // a shopper carrying a basket, and the storefront masthead offered them a
  // delivery promo, a cart and eleven departments to leave through.
  //
  // Rendered outside the 1600px content column as well, so the hero gradient
  // and the closing CTA can span the window the way marketing pages do. The
  // cart drawer, contact rail, cookie notice and bottom nav are all shopper
  // chrome and stay behind — except the cookie notice, which is a legal notice
  // and belongs on every page a visitor can land on.
  if (pathname === "/sell") {
    return (
      <>
        <SellHeader settings={settings} />
        <div className="flex-1">{children}</div>
        <SellFooter settings={settings} />
        <CookieNotice />
      </>
    );
  }

  if (pathname === "/checkout") {
    return (
      <>
        <header className="border-b border-shop-line bg-white">
          <div className="mx-auto flex max-w-[var(--shell)] items-center gap-4 px-4 py-4 md:px-8">
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
    // `contents` so the wrapper carries the token and nothing else: it draws
    // no box, so the body's flex column still sees the masthead, the content
    // and the footer as its own children and the sticky header still sticks.
    <div className="contents" style={isShopGrid ? ({ "--shell": "100%" } as React.CSSProperties) : undefined}>
      <Header departments={departments} settings={settings} />
      {/* ---- The content column ----
       *
       * Width only. No background and no border: the page is white everywhere
       * now, so a white sheet with hairline edges was drawing a box around
       * nothing. See the `--background` note in `globals.css` for why the tint
       * went away — short version, the gray-900 masthead gives the page its
       * horizon, which is the job the sheet was doing.
       *
       * The wrapper itself stays, and it is not vestigial. Most pages set their
       * own `mx-auto max-w-[var(--shell)]` on an inner container, but the homepage's
       * hero deliberately sits OUTSIDE that container so it can span the full
       * width without fighting its `md:px-8` padding. Without this, the hero
       * would stretch across an entire ultrawide monitor while every rail
       * beneath it stopped at 1600px. This is what bounds it. */}
      {/* ---- The page ground lives HERE, on the full-width element ----

           This is the only element in the storefront that is both full width
           and behind every page, and that turns out to matter more than it
           looks.

           The ground was set on `<main>` by each page that wanted it. `<main>`
           is inside the shell cap on the line below, so on a 1920px monitor it
           is 1720 wide and the tint stopped 100px short of each edge — leaving
           two white strips down the sides of the window, exactly where the
           floating contact rail sits. Every page that set its own ground
           reproduced the same two strips, because they were all setting it in
           the same wrong place.

           One declaration here fixes it for the whole storefront and gives the
           shop a single ground rather than a per-page one. The pages that used
           to carry `bg-shop-canvas` on their own `<main>` have had it removed;
           there is one source of truth for the page colour now.

           The Seller Centre, admin, checkout and /sell all return before this
           point, so none of them inherits it. */}
      {/* ---- The product page is white, and it has to be white out here ----

           `bg-white` on the product page's own `<main>` is not enough. `<main>`
           sits inside the shell cap on the line below, so on a 1920px monitor
           it is 1720 wide and the canvas shows as a 100px strip down each side
           — a white sheet floating on an off-white page, which is the exact
           seam this wrapper was created to remove in the first place.

           So the GROUND follows the route. A product page is one product and
           has no stack of shelves to separate, which is what the canvas is for;
           every other page has one and keeps it.

           `startsWith` rather than an exact match, because the route is
           `/products/[id]` and the id is a slug that can be anything. */}
      {/* One ground for the whole storefront.

           This used to branch: white on a product page, the canvas tint
           everywhere else, because a white product page between a tinted
           listing and a tinted basket read as a hole in the middle of the
           flow.

           The branch went when the canvas was briefly white and both arms
           resolved to the same colour. The canvas is off-white again — see the
           ninth-turn note in globals.css — and the branch is still gone, which
           is now a decision rather than a leftover: the product page sets
           `bg-white` on its own `<main>` and that is the right place for it,
           because a page that wants a different ground should say so itself
           rather than be named in a condition out here. */}
      <div className="flex-1 bg-shop-canvas">
        <div className="mx-auto w-full max-w-[var(--shell)]">{children}</div>
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
    </div>
  );
}
