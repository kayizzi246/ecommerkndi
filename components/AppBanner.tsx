"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "kandi-app-banner-dismissed";

export default function AppBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show once per visitor until dismissed; small delay so it doesn't
    // compete with the page load.
    if (localStorage.getItem(DISMISS_KEY)) return;
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="banner-up fixed inset-x-0 bottom-0 z-50 bg-black text-white">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 md:px-8">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-bfl-yellow text-xl">
          🛍️
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold">Shop faster on the Kandi app</p>
          <p className="hidden text-[12px] text-white/65 sm:block">
            App-only prices · order tracking · instant notifications
          </p>
        </div>
        <a href="#kandi-app" onClick={dismiss} className="btn-bfl shrink-0 px-5 py-2.5 text-[12px]">
          Get the app
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-xl leading-none text-white/60 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
