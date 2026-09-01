"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const ACK_KEY = "kandi-cookie-notice-v1";

/** Fired on acknowledgement so the sign-in banner knows it can take the slot. */
export const COOKIE_NOTICE_EVENT = "kandi:cookie-notice-acknowledged";

export function cookieNoticeAcknowledged(): boolean {
  try {
    return Boolean(localStorage.getItem(ACK_KEY));
  } catch {
    // Private browsing with storage blocked. Treat it as acknowledged rather
    // than showing a notice that can never be dismissed.
    return true;
  }
}

/**
 * The cookie notice.
 *
 * It is a *notice*, not a consent gate, and that is a deliberate and honest
 * choice: this storefront runs no analytics, no advertising pixels and no
 * third-party trackers whatsoever. The only things it stores are the sign-in
 * token that keeps you logged in and the basket in your own browser — strictly
 * necessary storage, which every privacy regime lets a shop use without asking.
 *
 * So there are no "manage preferences" toggles here. A banner offering to
 * refuse tracking that does not exist is theatre: it trains shoppers to click
 * through consent dialogs without reading them, and it would be a lie about
 * this shop. If a tracker is ever added, this component has to grow real
 * per-category consent — and the tracker must not load until it is given.
 *
 * It does not block the page, because nothing here needs permission before it
 * can run.
 */
export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Rendered after mount only: localStorage does not exist on the server, and
    // a notice in the server HTML would flash for everyone who already dismissed
    // it. A short delay keeps it out of the way of the first paint.
    if (cookieNoticeAcknowledged()) return;
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const acknowledge = () => {
    try {
      localStorage.setItem(ACK_KEY, new Date().toISOString());
    } catch {
      // Nothing to do — it will simply appear again next visit.
    }
    setVisible(false);
    window.dispatchEvent(new Event(COOKIE_NOTICE_EVENT));
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      // Above the sign-in banner and the mobile tab bar, and clear of both:
      // bottom-left on a desktop so it never covers the cart, full width above
      // the tab bar on a phone.
      className="banner-up fixed inset-x-3 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-[440px] rounded-xl border border-shop-line bg-white p-4 shadow-xl lg:inset-x-auto lg:left-5 lg:bottom-5 lg:mx-0"
    >
      <p className="text-[14px] font-bold text-shop-ink">Cookies on Kandi</p>
      <p className="mt-1 text-[13.5px] leading-[1.5] text-shop-body">
        We only use what the shop needs to work — keeping you signed in and
        remembering your basket. No advertising cookies, no third-party
        trackers, nothing sold to anyone.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={acknowledge}
          className="rounded-lg bg-shop-primary px-5 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-shop-primary-dark"
        >
          Got it
        </button>
        <Link
          href="/privacy#cookies"
          onClick={acknowledge}
          className="text-[13.5px] font-semibold text-shop-primary hover:underline"
        >
          Read more
        </Link>
      </div>
    </div>
  );
}
