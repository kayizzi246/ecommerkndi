"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    label: "Categories",
    /* Was `/#categories` — an anchor that exists on no page, so this tab did
       nothing at all when tapped. It now goes to the real departments page. */
    href: "/categories",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    label: "Cart",
    href: "/cart",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
      </svg>
    ),
  },
  {
    label: "Account",
    // The storefront now has its own dashboard, so this no longer bounces the
    // shopper out to the WordPress my-account page.
    href: "/account",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { count } = useCart();

  /**
   * Pages that carry their own bottom bar, and so must not carry this one too.
   *
   * A product page has a permanent Add to cart / Buy now bar and the cart has a
   * permanent Checkout bar. Stacking navigation underneath either one produces
   * two fixed bars competing for the same corner of a phone, eats about 110px
   * of a screen that is mostly product photograph, and puts "Home" directly
   * beneath "Buy now" — which is a misdirected tap at the exact moment the
   * shop is trying to take money.
   *
   * `startsWith` covers `/products/<id>` for every product.
   */
  const ownsBottomBar = pathname.startsWith("/products/") || pathname === "/cart";
  if (ownsBottomBar) return null;

  return (
    /**
     * The bar itself stays flat against the bottom edge rather than floating as
     * a rounded island: a detached pill looks smart in a mockup and costs a
     * real phone the strip of screen underneath it plus the gesture bar's own
     * margin. `pb-[env(safe-area-inset-bottom)]` is what keeps the tabs clear
     * of the home indicator on an iPhone, and it belongs on the bar, not on a
     * gap below it.
     */
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-shop-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {/* 64px, up from 60 — the icons inside went from 20px to 24px and from a
          1.5 to a 2 stroke, and the row needed the four pixels back so the
          label underneath does not crowd them.

          The weight matters more than the size here. At 1.5 these were the
          faintest marks on a phone screen, competing with product photography
          directly above them; at 2 they read as controls. The active state
          still switches to a solid fill rather than a heavier stroke, so which
          tab is current stays obvious at a glance. */}
      <div className="flex h-16 items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.href !== "/" && pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className={`relative flex w-full flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-semibold transition-colors ${
                isActive
                  ? "font-bold text-shop-primary"
                  : "font-medium text-shop-muted active:text-shop-ink"
              }`}
            >
              {/* The active tab is marked three ways at once — a short rule at
                  the top edge of the bar, a tinted pill under the icon, and the
                  brand orange on both icon and label. Colour alone would be the
                  only signal for anyone who cannot separate orange from grey,
                  and on a four-tab bar "which page am I on" is the only
                  question this component answers. */}
              <span
                aria-hidden
                className={`absolute top-0 h-[3px] w-9 rounded-b-full bg-shop-primary transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />

              <span
                className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                  isActive ? "bg-shop-primary-soft" : "bg-transparent"
                }`}
              >
                {item.icon(isActive)}
                {item.label === "Cart" && count > 0 && (
                  <span className="absolute right-1.5 top-0 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-shop-ember px-1 text-[9px] font-bold text-white ring-2 ring-white">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>

              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

