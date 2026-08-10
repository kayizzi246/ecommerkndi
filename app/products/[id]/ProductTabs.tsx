"use client";

import { useState } from "react";

type Tab = { id: string; label: string; content: React.ReactNode };

/**
 * Full-width tabbed panel for the secondary product copy.
 *
 * The copy used to be stacked in the narrow buy-box column, which pushed the
 * page into a long one-column scroll. Across the full width it reads as a
 * proper section: one row of tabs, one panel, no scrolling to find anything.
 */
export default function ProductTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  if (tabs.length === 0) return null;

  const panel = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <section className="mt-12 rounded-lg border border-shop-line bg-white">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-shop-line px-3 no-scrollbar">
        {tabs.map((tab) => {
          const selected = tab.id === panel.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={`relative whitespace-nowrap px-4 py-4 text-[15px] transition-colors ${
                selected
                  ? "font-semibold text-shop-ink"
                  : "text-shop-muted hover:text-shop-body"
              }`}
            >
              {tab.label}
              {selected && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-shop-primary" />
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${panel.id}`}
        aria-labelledby={`tab-${panel.id}`}
        className="px-5 py-7 md:px-8"
      >
        {panel.content}
      </div>
    </section>
  );
}
