"use client";

import type { ProductFeed } from "@/lib/use-product-feed";

/**
 * The foot of an infinite grid: the sentinel, and whatever the feed is doing.
 *
 * Four grids share it, so the four behave identically at the bottom of the
 * page — which matters more than it sounds. "Load more" on one page and a
 * spinner on another is the shop telling a shopper that two lists work
 * differently when they do not.
 *
 * ---- Why there is a button at all on an infinite grid ----
 *
 * The observer does the work; the button is the fallback for the two cases it
 * cannot cover. A failed page needs a way back that is not "scroll up and down
 * again", and a shopper on a browser or setting where the observer never fires
 * needs a way forward at all. It is also the only part of an infinite grid a
 * keyboard can reach.
 */
export default function ProductFeedFooter({
  feed,
  /** What the grid says when there is nothing left. */
  doneLabel = "You have seen everything in the shop.",
}: {
  feed: ProductFeed;
  doneLabel?: string;
}) {
  const { loading, failed, done, loadMore, sentinel } = feed;

  return (
    <div ref={sentinel} className="mt-10 flex justify-center">
      {loading && (
        <p className="text-[14px] text-shop-muted" role="status">
          Loading more…
        </p>
      )}

      {failed && (
        <button
          type="button"
          onClick={loadMore}
          className="rounded-lg border border-shop-line px-6 py-2.5 text-[14px] text-shop-ink transition-colors hover:border-shop-primary hover:text-shop-primary"
        >
          Could not load more — try again
        </button>
      )}

      {!loading && !failed && !done && (
        <button
          type="button"
          onClick={loadMore}
          className="rounded-lg border border-shop-line px-8 py-2.5 text-[14px] text-shop-ink transition-colors hover:border-shop-primary hover:text-shop-primary"
        >
          Load more
        </button>
      )}

      {done && <p className="text-[13px] text-shop-muted">{doneLabel}</p>}
    </div>
  );
}
