import Link from "next/link";
import Image from "next/image";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * The chrome for /sell — and only /sell.
 *
 * ---- Why this page does not wear the shop's masthead ----
 *
 * Every other page on this site is a storefront: the visitor is a shopper, and
 * the orange promo strip, the search field, the cart total and the department
 * bar are all things they came to use. /sell has a different visitor with a
 * different question. They are not buying anything; they are deciding whether
 * to put their business on this platform, and the whole page is one argument
 * aimed at that decision.
 *
 * The storefront masthead actively worked against it. It opened with "Your
 * order qualifies for FREE delivery", carried a cart holding somebody else's
 * shopping, and offered eleven departments to wander off into — three
 * invitations to stop reading, above the fold, on the one page whose only job
 * is to be read to the end. And it told the reader, visually, that this is a
 * shop they are inside rather than a service they could buy.
 *
 * So this is the convention every software company's marketing site uses
 * instead, because it is the right shape for the job: a thin translucent bar
 * that stays out of the way, the product name rather than the shop's, section
 * anchors instead of a catalogue, one quiet secondary action (sign in) and one
 * loud primary one (start selling) repeated at the foot of the page.
 *
 * Nothing here is a shopper control. There is no cart, no search and no
 * department nav — those belong to the store, and a seller who wants the store
 * has the wordmark, which still goes home.
 */

/** The nav is short on purpose: four anchors is a table of contents, ten is a menu. */
const SECTIONS = [
  { href: "#why", label: "Why Kandi" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

function Wordmark({ settings }: { settings: SiteSettings }) {
  if (settings.brand.logo_url) {
    // Same reasoning as the storefront masthead: an uploaded logo is somebody
    // else's file and cannot be assumed to sit on any particular ground. Here
    // the bar is white, so it needs no plate — only a bounded height so a wide
    // file cannot push the nav off the row.
    return (
      <Image
        src={settings.brand.logo_url}
        alt={settings.brand.name}
        width={200}
        height={48}
        unoptimized
        // Bigger than the storefront masthead wears it, and deliberately: there
        // the logo shares the row with a search field, an account menu and a
        // cart, so it has to be small to leave them room. Here it has a row to
        // itself, and it is the only thing on this page saying who is asking a
        // seller for their business.
        className="h-10 w-auto max-w-[190px] object-contain md:h-11"
      />
    );
  }

  return (
    <span className="text-[26px] font-bold tracking-[-0.02em] text-shop-ink md:text-[28px]">
      {settings.brand.name}
      <span className="text-shop-primary">.</span>
    </span>
  );
}

export function SellHeader({ settings }: { settings: SiteSettings }) {
  return (
    // Sticky and translucent, which is the one piece of behaviour that matters
    // here: the primary action has to stay reachable from anywhere on a page
    // this long, and a reader who has scrolled to the FAQ is exactly the reader
    // most likely to act. `backdrop-blur` rather than a solid fill so the page
    // still reads as one surface passing underneath.
    <header className="sticky top-0 z-40 border-b border-shop-line/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 px-4 md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Wordmark settings={settings} />
          {/* The product name, set as a chip rather than as more wordmark. This
              is a distinct product with its own pricing sitting inside a larger
              brand, and that relationship is what the chip states. */}
          <span className="rounded-md bg-shop-hairline px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-shop-body">
            Sellers
          </span>
        </Link>

        {/* Anchors only from lg. Below that they would either wrap the bar onto
            two rows or need a hamburger — and a hamburger holding four in-page
            anchors is a menu built for the sake of having one. The page is a
            single scroll; the sections are found by scrolling. */}
        <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="text-[14px] font-medium text-shop-body transition-colors hover:text-shop-ink"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {/* Secondary action, and deliberately quiet: a seller returning to
              their dashboard knows where they are going, while a first-time
              reader must not be offered two equal-weight buttons. */}
          <Link
            href="/seller/login"
            className="hidden rounded-full px-4 py-2 text-[14px] font-medium text-shop-body transition-colors hover:text-shop-ink sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/seller/register"
            className="inline-flex items-center rounded-full bg-shop-ink px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Start selling
          </Link>
        </div>
      </div>
    </header>
  );
}

/** One column of the footer's link grid. */
function LinkColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-shop-muted">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="text-[14px] text-shop-body transition-colors hover:text-shop-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SellFooter({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-shop-line bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-14 md:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* The brand column carries the contact details rather than a fifth
              link list. A seller's last unanswered question on this page is
              usually "is there a person behind this", and a phone number
              answers it in a way a Contact link does not. */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Wordmark settings={settings} />
            </Link>
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-shop-body">
              The storefront, the payments and the delivery — run for you, so you can get on
              with stocking and selling.
            </p>
            <div className="mt-5 space-y-1 text-[14px] text-shop-body">
              {settings.support.email && (
                <p>
                  <a
                    href={`mailto:${settings.support.email}`}
                    className="transition-colors hover:text-shop-ink"
                  >
                    {settings.support.email}
                  </a>
                </p>
              )}
              {settings.support.phone && (
                <p>
                  <a
                    href={`tel:${settings.support.phone.replace(/\s+/g, "")}`}
                    className="transition-colors hover:text-shop-ink"
                  >
                    {settings.support.phone}
                  </a>
                </p>
              )}
              {settings.support.hours && (
                <p className="text-shop-muted">{settings.support.hours}</p>
              )}
            </div>
          </div>

          <LinkColumn
            title="Selling"
            links={[
              { href: "/seller/register", label: "Start selling" },
              { href: "/seller/login", label: "Seller sign in" },
              { href: "#pricing", label: "Pricing" },
              { href: "/seller-policies", label: "Seller policies" },
            ]}
          />
          <LinkColumn
            title="Support"
            links={[
              { href: "/help", label: "Help centre" },
              { href: "/contact", label: "Contact us" },
              { href: "/shipping", label: "Delivery" },
              { href: "/returns", label: "Returns" },
            ]}
          />
          <LinkColumn
            title="Company"
            links={[
              { href: "/about", label: `About ${settings.brand.name}` },
              { href: "/careers", label: "Careers" },
              { href: "/", label: "Visit the shop" },
              { href: "/sellers", label: "Browse stores" },
            ]}
          />
        </div>

        {/* ---- The bottom bar ----
             Copyright, jurisdiction and the two legal documents, kept apart
             from the link grid above by a hairline. This is the row a reader
             checks to confirm the company is real, which is why it is plain
             text rather than another set of buttons. */}
        <div className="mt-12 flex flex-col gap-3 border-t border-shop-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-shop-muted">
            © {year} {settings.brand.name} {settings.brand.suffix}. Kampala, Uganda.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/terms"
              className="text-[13px] text-shop-muted transition-colors hover:text-shop-ink"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-[13px] text-shop-muted transition-colors hover:text-shop-ink"
            >
              Privacy
            </Link>
            <Link
              href="/seller-policies"
              className="text-[13px] text-shop-muted transition-colors hover:text-shop-ink"
            >
              Seller terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
