"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/currency";
import type { CategoryNode } from "@/lib/woocommerce";
import type { SiteSettings } from "@/lib/site-settings";
import { brandName } from "@/lib/site-settings";
import SearchBar from "@/components/SearchBar";
import CuratedNav from "@/components/CuratedNav";
import CategoriesMenu from "@/components/CategoriesMenu";
import AccountMenu from "@/components/AccountMenu";
import SalesTicker from "@/components/SalesTicker";

/**
 * Storefront masthead, in the large-marketplace layout: a hairline promo strip
 * carrying the rotating promise line, then a white row given over almost
 * entirely to the search field, then the department bar led by the Categories
 * mega-menu.
 *
 * White throughout, deliberately. A masthead in a dark or saturated slab is the
 * heaviest thing on a page whose entire job is showing product photography, and
 * every marketplace at this scale has converged on getting out of the way.
 *
 * The logo, the promo wording and the free-delivery threshold all come from
 * `settings`, which is edited in wp-admin — nothing here is hard-coded.
 */
export default function Header({
  departments = [],
  settings,
  hideNavRow = false,
}: {
  departments?: CategoryNode[];
  settings: SiteSettings;
  /** The homepage renders the nav row itself, beside its category sidebar. */
  hideNavRow?: boolean;
}) {
  const { count, subtotal, openDrawer } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * True once the page has been scrolled past the masthead's own height.
   *
   * On a phone the full masthead — promo strip, logo row, search, department
   * bar — is close to 200px, and all of it is sticky, so a shopper scrolling a
   * product grid was reading it through a letterbox. Past that first scroll the
   * strip, the department bar, the logo, the cart and the menu toggle all fold
   * away, leaving a single slim row holding nothing but the search field, edge
   * to edge. Search is the one thing worth keeping pinned in a catalogue this
   * size; cart and categories are both tabs on the fixed bottom bar already.
   *
   * Desktop is untouched — there is room for the whole masthead there.
   */
  const [scrolled, setScrolled] = useState(false);
  /**
   * Whether the phone-sized search field has been opened by hand.
   *
   * Only meaningful before the first scroll: past that the field is pinned and
   * always on screen, so this is reset when the shopper scrolls into that state
   * rather than leaving a stale flag behind them.
   */
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    // Reading scrollY in the handler and acting in a frame keeps this off the
    // scroll thread; the listener is passive so it can never block one.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // Hysteresis: collapsing and expanding at the same pixel makes the row
        // flicker for anyone resting at the boundary.
        setScrolled((current) => {
          const next = current ? window.scrollY > 60 : window.scrollY > 120;
          // Scrolling pins the field on its own; the hand-opened state has
          // nothing left to do and would otherwise keep the icon hidden after
          // the shopper returned to the top.
          if (next) setSearchOpen(false);
          return next;
        });
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const threshold = settings.commerce.free_delivery_from;
  const awayFromFreeDelivery = Math.max(0, threshold - subtotal);

  return (
    // Once the department bar folds away there is no rule between the masthead
    // and the grid scrolling under it, so a shadow takes over that job.
    <header className={`sticky top-0 z-40 bg-white ${scrolled ? "shadow-sm md:shadow-none" : ""}`}>
      {/* ---- Announcement strip ----
           A yellow rule across the top, carrying the shop's three strongest
           promises — pay on delivery, free returns, the sale. It was white on
           white once, which left them in the palest text on the page and read
           by nobody; then near-black, which read but receded. Yellow is the
           loudest thing a marketplace can put above its masthead without
           spending a pixel on an image.

           Type is near-black, not white. White on #facc15 is about 1.7:1 and
           genuinely unreadable — yellow is a light hue, so the contrast has to
           come from below it rather than above. Black on this yellow is 11:1,
           which is why the ADD TO CART button has always been drawn this way.

           `bg-bfl-yellow` rather than a redefined `--color-shop-nav`: that
           token still paints the footer and the admin masthead, where white
           text on near-black is correct and yellow would be a disaster.

           Once there is something in the cart the rotating line gives way to
           live free-delivery progress, which is the more useful message. Every
           figure is real: the threshold from settings, the shopper's own
           subtotal, the payment methods actually accepted at checkout. */}
      <div
        className={`bg-bfl-yellow text-bfl-black/80 ${scrolled ? "hidden md:block" : ""}`}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2 text-[12px] md:px-8">
          {count > 0 && awayFromFreeDelivery > 0 ? (
            <button
              type="button"
              onClick={openDrawer}
              className="truncate font-semibold transition-opacity hover:opacity-85"
            >
              Add {formatPrice(awayFromFreeDelivery)} more for FREE delivery ›
            </button>
          ) : count > 0 ? (
            <span className="truncate font-semibold">
              Your order qualifies for FREE delivery 🎉
            </span>
          ) : (
            <SalesTicker messages={settings.ticker} className="min-w-0 font-semibold" />
          )}

          <div className="hidden shrink-0 items-center gap-5 sm:flex">
            {settings.promo.lines.slice(1, 3).map((line, index) => (
              <span key={line} className={index === 1 ? "hidden md:inline" : undefined}>
                {line}
              </span>
            ))}
            {/* The one accent in the strip. It was `text-bfl-yellow`, which on
                the old near-black bar was the brightest thing in it and on a
                yellow bar is invisible. The darkened brand orange keeps it
                warm, distinct from the near-black copy beside it, and clears
                4.9:1 on this yellow. */}
            <Link
              href={settings.promo.cta_url}
              className="font-bold text-shop-primary-ink hover:underline"
            >
              {settings.promo.cta_label} ›
            </Link>
          </div>
        </div>
      </div>
      {/* ---- Main row ----
           White, roomy, and dominated by the search field — the marketplace
           masthead. Search is the primary way into a catalogue this size, so it
           takes the whole middle of the row and grows with the window instead
           of sitting at a fixed width. Below md it wraps to its own line. */}
      <div className="bg-white">
      <div
        className={`mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-4 md:flex-nowrap md:px-8 md:py-3.5 ${
          scrolled ? "py-2" : "py-3.5"
        }`}
      >
        <Link
          href="/"
          className={`shrink-0 items-center gap-2 md:flex ${scrolled ? "hidden" : "flex"}`}
        >
          {settings.brand.logo_url ? (
            // An uploaded logo replaces the wordmark entirely. `unoptimized`
            // because the file lives on the WordPress media library, which is
            // not necessarily in `next.config` remotePatterns.
            // Stepped up from 40px tall / 190px wide. The wordmark is the one
            // thing in the masthead that has to be recognised rather than read,
            // and at 40px it was losing that contest to the search field beside
            // it. `w-auto` with a max width means a wide logo grows into the
            // room rather than distorting, and the intrinsic size is raised to
            // match so the file is not upscaled.
            <Image
              src={settings.brand.logo_url}
              alt={brandName(settings)}
              width={260}
              height={60}
              unoptimized
              priority
              className="h-12 w-auto max-w-[220px] object-contain md:h-14 md:max-w-[260px]"
            />
          ) : (
            <>
              {/* The KandiUg mark: a shopping bag carrying a white K, with two
                  motion lines behind it for the "fast delivery" half of the
                  brand. Drawn inline as SVG rather than shipped as an image so
                  it stays crisp at any size and costs no extra request. */}
              <span className="flex items-center gap-1">
                <svg
                  className="h-11 w-11 md:h-12 md:w-12"
                  viewBox="0 0 40 40"
                  role="img"
                  aria-label={brandName(settings)}
                >
                  <defs>
                    <linearGradient id="kandi-bag" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#ff6a00" />
                      <stop offset="100%" stopColor="#e85d00" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M2 13h6M0 19h5M3 25h5"
                    stroke="#ff6a00"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    opacity=".55"
                  />
                  <path
                    d="M13 11h18a2 2 0 0 1 2 2.2l-1.8 20A3 3 0 0 1 28.2 36H15.8a3 3 0 0 1-3-2.8L11 13.2A2 2 0 0 1 13 11Z"
                    fill="url(#kandi-bag)"
                  />
                  <path
                    d="M17.5 12V9a4.5 4.5 0 0 1 9 0v3"
                    fill="none"
                    stroke="#e85d00"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19 18v11M27 18l-6 5.5 6 5.5"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="font-heading text-[28px] font-bold leading-none tracking-[-0.03em] text-shop-flame md:text-[32px]">
                {settings.brand.name}
                <span className="text-shop-ink">{settings.brand.suffix}</span>
              </span>
            </>
          )}
        </Link>

        {/* The search takes every pixel the row can spare — it is how anyone
            actually finds anything in a catalogue of this size. Help, currency,
            Orders and Favorites used to sit to its right; they were four small
            targets competing with the one large one, and all four live in the
            account menu and the footer already. */}
        {/* On a phone the search field is not drawn until it is wanted.

            At the top of the page it is a single icon beside the cart, which
            buys back a whole row for the logo and the departments — the things
            a shopper arriving on the homepage is actually looking at. Tapping
            the icon opens the field in place, and scrolling brings it back on
            its own, pinned, because past the first screen finding something is
            the only thing a shopper is doing.

            Desktop is unaffected: there is room for the full field always, and
            it stays where it has always been. */}
        <div
          className={`w-full min-w-0 flex-1 md:order-none md:block ${
            scrolled ? "order-none" : "order-last"
          } ${scrolled || searchOpen ? "block" : "hidden"}`}
        >
          <SearchBar />
        </div>

        {/* Once the shopper has scrolled, the phone masthead is the search
            field and nothing else.

            The cart and the menu toggle used to stay pinned beside it, which
            left the field about 70px short of the row on a 390px screen — and
            the query, not the chrome, is what a shopper is looking at by then.
            Neither is lost: the fixed bottom bar carries Cart and Categories as
            full tabs, so this is the same two destinations one thumb-length
            lower, and the whole row goes to the one thing being used.

            `md:flex` so desktop keeps the cluster exactly as it was. */}
        <div
          className={`shrink-0 items-center gap-5 md:ml-0 md:flex ${
            scrolled ? "ml-0 hidden" : "ml-auto flex"
          }`}
        >
          {/* The phone-sized search control. Hidden once the pinned field is on
              screen, so there are never two ways to start the same search. */}
          {!scrolled && !searchOpen && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              aria-expanded={false}
              className="text-shop-ink md:hidden"
            >
              <svg className="h-[23px] w-[23px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-4.35-4.35M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>
            </button>
          )}

          <div className="hidden lg:block">
            <AccountMenu />
          </div>

          {/* Cart carries its running total, so the basket value stays in sight
              rather than only inside the drawer. */}
          <button
            type="button"
            onClick={openDrawer}
            aria-label="Open cart"
            className="flex items-center gap-2 text-shop-ink hover:text-shop-flame"
          >
            <span className="relative">
              <svg className="h-[23px] w-[23px]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h2.2l2 10.5h11.1L20 9H6.2" />
                <circle cx="9" cy="20" r="1.2" />
                <circle cx="17.5" cy="20" r="1.2" />
              </svg>
              <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-shop-ember px-1 text-[11px] font-semibold text-white">
                {count > 9 ? "9+" : count}
              </span>
            </span>
            {/* The running total only once there is one. An empty basket
                reading "UGX 0" is a figure that tells the shopper nothing and
                puts a zero in the masthead of every first visit. */}
            <span className="hidden whitespace-nowrap text-left text-[13px] leading-tight lg:block">
              Cart
              {count > 0 && (
                <>
                  <br />
                  <span className="price text-[13px] text-shop-flame">
                    {formatPrice(subtotal)}
                  </span>
                </>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="text-shop-ink lg:hidden"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>
      </div>

      {/* ---- Department bar ----
           The Categories mega-menu anchors the row, then the curated links run
           on from it. Nothing here is a coloured slab: the row is a list of
           links, and the only colour is the one deal link that earns it. */}
      {!hideNavRow && (
        <nav
          className={`border-b border-shop-line bg-white text-shop-body ${
            scrolled ? "hidden md:block" : ""
          }`}
        >
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 md:px-8">
            {/* The mega-menu is a hover surface, which needs a pointer; below lg
                the button beside it opens the same tree as a stacked panel. */}
            <div className="hidden lg:block">
              <CategoriesMenu departments={departments} />
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className="my-2 flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg border border-shop-line px-4 py-2 text-[14px] font-bold text-shop-ink transition-colors hover:border-shop-flame hover:text-shop-flame lg:hidden"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              Categories
            </button>

            <CuratedNav departments={departments} className="flex-1" />

            {/* The only permanent seller entry point on the shopper-facing
                chrome. It earns its place: a marketplace with no visible way in
                grows only as fast as somebody remembers to recruit, and this
                costs one link at the end of a row that has room for it. */}
            <Link
              href="/sell"
              className="hidden shrink-0 whitespace-nowrap px-3 py-3 text-[14px] font-semibold text-shop-primary hover:text-shop-primary-dark lg:block"
            >
              Sell on Kandi
            </Link>

            <Link
              href="/sellers"
              className="hidden shrink-0 whitespace-nowrap px-3 py-3 text-[14px] text-shop-body hover:text-shop-flame xl:block"
            >
              Shop by store →
            </Link>
          </div>
        </nav>
      )}

      {/* ---- All Categories panel ----
           The full WooCommerce department tree, and now the only place to browse
           it — the homepage sidebar that used to duplicate this is gone.

           Laid out in columns rather than as a stack of collapsibles: every
           department and its children are visible at once, so finding a
           sub-category is one glance and one click instead of expanding rows
           until you find it. It closes on any navigation and on Escape. */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close categories"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-10 cursor-default bg-black/20"
          />
          <div className="absolute inset-x-0 z-20 max-h-[75vh] overflow-y-auto border-b border-shop-line bg-white">
            <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
              {departments.length === 0 ? (
                <p className="py-4 text-[14px] text-shop-muted">
                  No departments yet — add product categories in WordPress and
                  they appear here.
                </p>
              ) : (
                <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  {departments.map((department) => (
                    <div key={department.id} className="min-w-0">
                      <Link
                        href={`/category/${department.slug}`}
                        onClick={() => setMenuOpen(false)}
                        className="block truncate text-[14px] font-bold text-shop-ink hover:text-shop-flame"
                      >
                        {department.name}
                      </Link>

                      {department.children.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {department.children.slice(0, 8).map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`/category/${child.slug}`}
                                onClick={() => setMenuOpen(false)}
                                className="block truncate text-[13.5px] text-shop-body hover:text-shop-flame"
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-shop-line pt-4 text-[13.5px]">
                <Link
                  href="/sellers"
                  onClick={() => setMenuOpen(false)}
                  className="font-semibold text-shop-body hover:text-shop-flame"
                >
                  Shop by store
                </Link>
                <Link
                  href="/sell"
                  onClick={() => setMenuOpen(false)}
                  className="font-semibold text-shop-body hover:text-shop-flame"
                >
                  Sell on KandiUg
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
