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
    <div className="banner-up fixed bottom-0 inset-x-0 z-50 border-t border-white/20 bg-black text-white">
      <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 md:px-8 py-3">
        <span className="bg-sun rounded-xl w-11 h-11 flex items-center justify-center text-xl shrink-0">
          🛍️
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Shop faster on the Kandi app</p>
          <p className="text-xs text-gray-300 hidden sm:block">
            Exclusive app-only deals · order tracking · instant notifications
          </p>
        </div>
        <a
          href="#kandi-app"
          onClick={dismiss}
          className="bg-sale hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-full shrink-0"
        >
          Get the app
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-gray-400 hover:text-white text-xl leading-none shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
