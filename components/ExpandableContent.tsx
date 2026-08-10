"use client";

import { useCallback, useState } from "react";

/**
 * Clamps long content to a fixed height with a fade at the cut, and reveals the
 * rest behind a Show more / Show less toggle.
 *
 * Product descriptions imported from WordPress run to spec tables and size
 * charts thousands of pixels tall, which buries everything below them. The
 * toggle only appears when the content actually overflows — measured through a
 * callback ref, so short descriptions render untouched with no button.
 */
export default function ExpandableContent({
  children,
  collapsedHeight = 320,
  moreLabel = "Show more",
  lessLabel = "Show less",
}: {
  children: React.ReactNode;
  collapsedHeight?: number;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // A callback ref rather than an effect, so measurement happens as the node
  // mounts. The observer keeps it honest when images inside the description
  // finish loading and change the height after that first read.
  const measure = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;

      const check = () => setOverflows(node.scrollHeight > collapsedHeight + 32);
      check();

      const observer = new ResizeObserver(check);
      observer.observe(node);
      return () => observer.disconnect();
    },
    [collapsedHeight]
  );

  return (
    <div>
      <div className="relative">
        <div
          ref={measure}
          style={{ maxHeight: expanded || !overflows ? undefined : collapsedHeight }}
          className={expanded || !overflows ? "" : "overflow-hidden"}
        >
          {children}
        </div>

        {overflows && !expanded && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent"
          />
        )}
      </div>

      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="btn-shop-outline mt-4 px-5 py-2.5 text-[14px]"
        >
          {expanded ? lessLabel : moreLabel}
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
