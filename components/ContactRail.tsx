"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Support = {
  phone: string;
  email: string;
  whatsapp: string;
};

/**
 * The floating contact rail.
 *
 * A narrow column of round buttons pinned to the side of the window — WhatsApp,
 * a call, help, and back to top — modelled on the rail every large marketplace
 * parks against the edge of the screen.
 *
 * The argument for it on *this* shop is stronger than on the ones it is copied
 * from. Kandi takes payment on delivery and sells to a market that buys by
 * conversation: the commonest reason an order does not happen here is a question
 * nobody could be bothered to hunt for an answer to. The contact details existed
 * — in the footer, and on /contact — which is to say they existed at the end of
 * a scroll or behind a click, at the exact moment a shopper is deciding whether
 * to bother. This puts them at a constant, ignorable distance instead.
 *
 * Every entry is real: the numbers come from wp-admin, and an entry whose
 * setting is blank does not render rather than pointing at an empty `tel:`.
 *
 * ---- Where it sits ----
 *
 * Right, which is where the reference puts it, and the left edge turned out to
 * be unavailable for a concrete reason: /search and /category carry a filter
 * sidebar pinned to that edge, and a rail there lands squarely on the price
 * inputs. Nothing occupies the right margin at this height — the cart drawer
 * (z-90) and the sticky buy bar (z-60) both sit above this rail's z-40, so the
 * drawer covers it while open, which is the correct behaviour for a modal, and
 * the buy bar hugs the bottom while this is vertically centred.
 *
 * Hidden below `lg`. On a phone the screen is the width of a thumb and this
 * would sit on top of the products; the mobile bottom bar is where those taps
 * already live.
 */
export default function ContactRail({ support }: { support: Support }) {
  /**
   * "Back to top" appears only once there is a top to go back to.
   *
   * A scroll-to-top button on an unscrolled page is a button that does nothing,
   * and it is the entry most likely to be pressed by accident on a rail this
   * small.
   */
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 600);
    onScroll();
    // Passive: this listener never calls preventDefault, and saying so lets the
    // browser scroll without waiting to find out.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** Digits only — a number typed as "+256 700 123 456" breaks a tel: link. */
  const dialable = support.phone.replace(/[^\d+]/g, "");

  return (
    <aside
      aria-label="Contact us"
      className="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2 lg:flex"
    >
      {support.whatsapp && (
        <RailButton
          href={`https://wa.me/${support.whatsapp.replace(/[^\d]/g, "")}`}
          label="WhatsApp"
          external
        >
          <svg aria-hidden className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42l-.47-.01c-.16 0-.43.06-.65.31-.22.25-.85.84-.85 2.04s.87 2.37.99 2.53c.12.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
          </svg>
        </RailButton>
      )}

      {dialable && (
        <RailButton href={`tel:${dialable}`} label="Call us">
          <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.28 6.72 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.37c0-.52-.35-.97-.85-1.09l-4.42-1.1a1.12 1.12 0 0 0-1.17.42l-.97 1.29a12.04 12.04 0 0 1-5.5-5.5l1.29-.97c.38-.28.54-.75.42-1.17l-1.1-4.42a1.12 1.12 0 0 0-1.09-.85H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          </svg>
        </RailButton>
      )}

      <RailButton href="/help" label="Help centre">
        <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 9.5a2.1 2.1 0 1 1 2.85 1.96c-.5.19-.75.66-.75 1.19v.6" />
          <path strokeLinecap="round" d="M12 16.5h.01" />
        </svg>
      </RailButton>

      {/* Not conditionally *mounted* — hidden. Mounting it on scroll makes the
          rail jump as the page moves, which drags the eye to the one part of
          the screen that is supposed to stay still. */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        aria-hidden={!scrolled}
        tabIndex={scrolled ? 0 : -1}
        className={`group relative flex h-11 w-11 items-center justify-center rounded-full border border-shop-line bg-white text-shop-body shadow-sm transition-all hover:border-shop-primary hover:text-shop-primary ${
          scrolled ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 15 7-7 7 7" />
        </svg>
        <RailLabel>Back to top</RailLabel>
      </button>
    </aside>
  );
}

/** One round button, with a label that slides out on hover. */
function RailButton({
  href,
  label,
  external = false,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "group relative flex h-11 w-11 items-center justify-center rounded-full border border-shop-line bg-white text-shop-body shadow-sm transition-colors hover:border-shop-primary hover:text-shop-primary";

  // `tel:` and `wa.me` are not app routes, so they get a plain anchor — handing
  // them to next/link would have the router try to navigate to them.
  if (external || href.startsWith("tel:")) {
    return (
      <a
        href={href}
        target={href.startsWith("tel:") ? undefined : "_blank"}
        rel={href.startsWith("tel:") ? undefined : "noopener noreferrer"}
        aria-label={label}
        className={className}
      >
        {children}
        <RailLabel>{label}</RailLabel>
      </a>
    );
  }

  return (
    <Link href={href} aria-label={label} className={className}>
      {children}
      <RailLabel>{label}</RailLabel>
    </Link>
  );
}

/**
 * The name of the button, revealed on hover.
 *
 * `aria-hidden` because the control it belongs to already carries the same words
 * in its `aria-label`; without it every button here announces itself twice.
 */
function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-shop-ink px-2.5 py-1.5 text-[12.5px] font-semibold text-white group-hover:block"
    >
      {children}
    </span>
  );
}
