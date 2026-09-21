import Link from "next/link";
import { formatPrice } from "@/lib/currency";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * The four promises, directly under the hero.
 *
 * Every one of them is a fact the shop states elsewhere and can be held to —
 * the delivery windows on the shipping page, the returns window and the free
 * delivery threshold from wp-admin, the vetting claim in the closing copy. That
 * constraint is the whole point: "SAFE & SECURE Shopping" and "BIG DEALS
 * Everyday" are what a page says when it has nothing specific to offer, and
 * three capitalised abstractions in a row is the loudest tell that copy was
 * generated rather than written by somebody who knows the business.
 *
 * Each one links to the page that proves it, so the bar is navigation as well
 * as reassurance rather than four decorative icons.
 *
 * The icons are drawn inline rather than loaded from `public/`. At four marks
 * that is four fewer requests in the first screen, and — the part that matters
 * more — they take `currentColor`, so they follow the brand token instead of
 * being a second place the orange has to be kept in step by hand.
 */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="h-[22px] w-[22px] md:h-6 md:w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export default function TrustBar({ settings }: { settings: SiteSettings }) {
  const promises = [
    {
      label: "Fast delivery",
      note: "Kampala in 1–2 days",
      href: "/shipping",
      icon: (
        <Glyph>
          <path d="M3 7h11v9H3V7ZM14 10h4l3 3v3h-7v-6Z" />
          <circle cx="7.5" cy="18" r="1.7" />
          <circle cx="17" cy="18" r="1.7" />
        </Glyph>
      ),
    },
    {
      label: "Pay on delivery",
      note: "Cash, MTN MoMo or Airtel",
      href: "/help",
      icon: (
        <Glyph>
          <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
          <circle cx="12" cy="12" r="2.6" />
          <path d="M6 12h.01M18 12h.01" />
        </Glyph>
      ),
    },
    {
      label: "Vetted sellers",
      note: "Every store checked",
      href: "/sellers",
      icon: (
        <Glyph>
          <path d="M12 3.2 5 5.8v5.4c0 4.2 2.9 7.6 7 9.1 4.1-1.5 7-4.9 7-9.1V5.8l-7-2.6Z" />
          <path d="m9.2 12.1 2 2 3.6-3.8" />
        </Glyph>
      ),
    },
    {
      label: "Free returns",
      note: `${settings.commerce.returns_days} days to change your mind`,
      href: "/returns",
      icon: (
        <Glyph>
          <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
          <path d="M3.5 4.5V10H9" />
        </Glyph>
      ),
    },
  ];

  return (
    <section aria-label="Why shop with us">
      {/* One sheet with hairline seams rather than four cards with air between
          them — four separated boxes are four objects a shopper takes in one at
          a time, where four cells sharing a seam read as one statement. The
          same move `FeatureCards` makes, and `feature-sheet` already draws it.

          No `phone-gutter` on the sheet: `.feature-sheet` squares its corners
          below md precisely because it is full-bleed down there, and an inset
          block with square corners reads as a rendering fault.

          Two across on a phone: four in a row at 360px is a 78px cell, which
          puts the note under each label at a size nobody reads. */}
      <ul className="feature-sheet grid grid-cols-2 lg:grid-cols-4">
        {promises.map((promise) => (
          <li key={promise.label}>
            <Link
              href={promise.href}
              className="group flex h-full items-center gap-3 bg-white px-3.5 py-3.5 transition-colors hover:bg-shop-primary-soft md:px-5 md:py-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shop-primary-soft text-shop-primary-ink transition-transform duration-200 ease-out group-hover:-translate-y-0.5 md:h-11 md:w-11">
                {promise.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold leading-tight text-shop-ink md:text-[14px]">
                  {promise.label}
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-tight text-shop-muted md:text-[12px]">
                  {promise.note}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* The free-delivery threshold is the one promise with a number the shop
          edits, and it belongs under the bar rather than inside a cell — it
          qualifies the first promise rather than standing beside it. */}
      <p className="phone-gutter mt-2 text-center text-[11px] text-shop-muted md:text-[12px]">
        Free delivery on every order over{" "}
        <span className="font-semibold text-shop-ink">
          {formatPrice(settings.commerce.free_delivery_from)}
        </span>
        , countrywide.
      </p>
    </section>
  );
}
