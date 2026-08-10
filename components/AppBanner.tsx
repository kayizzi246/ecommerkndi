"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCustomerSession } from "@/lib/customer-session";

const DISMISS_KEY = "kandi-signin-banner-dismissed";

/**
 * One-time prompt along the bottom of the page.
 *
 * It used to advertise a mobile app that does not exist and linked to an
 * anchor in the footer. It now offers the thing the storefront actually has —
 * an account — and only to shoppers who are not already signed in.
 */
export default function AppBanner() {
  const { customer, loading } = useCustomerSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show once per visitor until dismissed; a small delay so it does not
    // compete with the page load.
    if (localStorage.getItem(DISMISS_KEY)) return;
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  // Nothing to offer someone who already has an account.
  if (!visible || loading || customer) return null;

  return (
    <div className="banner-up fixed inset-x-0 bottom-0 z-50 bg-shop-nav text-white">
      <div className="mx-auto flex max-w-[1450px] items-center gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl">
          🛍️
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Track every order in one place</p>
          <p className="hidden text-[13px] text-white/75 sm:block">
            Order history · wishlist · reviews · faster checkout
          </p>
        </div>
        <Link
          href="/account"
          onClick={dismiss}
          className="shrink-0 rounded-lg bg-white px-5 py-2.5 text-[14px] font-semibold text-shop-nav transition-opacity hover:opacity-90"
        >
          Create account
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-xl leading-none text-white/70 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
