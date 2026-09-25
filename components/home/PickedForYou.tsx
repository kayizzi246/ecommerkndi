"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import InfiniteProducts from "@/components/home/InfiniteProducts";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/woocommerce";
import { PRODUCT_GRID } from "@/lib/product-grid";

/**
 * "You might like" — the tab row, and the endless grid under it.
 *
 * ---- Where the department rails went ----
 *
 * The page carried up to five of them: For men, For women, For kids, Shoes,
 * Sports, each a heading, a subtitle, a tinted band and a twelve-tile carousel.
 * Every one was desktop-only, so the shop's majority device never saw any of
 * them, and stacked they were five screens of the same catalogue in five
 * orders.
 *
 * They are tabs now. The same five departments, the same twelve products each,
 * on every device — one row of chips instead of five bands, and a shopper who
 * wants the women's section gets it in one tap rather than three screens of
 * scrolling past the men's.
 *
 * The products come from the feed already composed, so switching to a department
 * tab is instant and costs no request. That is the reason the tabs hold products
 * rather than being links to the category pages: a chip that navigates is a
 * slower way of saying what the masthead already says, and a chip that swaps the
 * grid under it is the thing the rails were trying to be.
 *
 * ---- Only the first tab is endless ----
 *
 * "For you" is the general catalogue and it scrolls forever, which is what a
 * phone front page needs — see `InfiniteProducts`. A department tab shows the
 * twelve the feed fetched and then hands over to the category page, and it says
 * so in a link at the foot rather than pretending to run out. Making them all
 * endless would mean a fetch per tab and a page-count per department the feed
 * does not have; the category page already does that job properly.
 */

export type PickedTab = {
  id: string;
  title: string;
  /** Null when the shop has not created this department yet. */
  slug: string | null;
  products: Product[];
};

const FOR_YOU = "for-you";
/**
 * "New in" — the catalogue newest first, with nothing ahead of it. "For you"
 * leads with the shop's featured picks, which pushes a product listed this
 * morning several screens down; this tab is where it shows first.
 */
const NEW_IN = "new-in";

export default function PickedForYou({
  latest,
  newest,
  latestTotalPages,
  tabs,
}: {
  latest: Product[];
  /** Newest-first page one of the catalogue, without the featured picks. */
  newest: Product[];
  latestTotalPages: number;
  tabs: PickedTab[];
}) {
  const [active, setActive] = useState(FOR_YOU);
  const rowRef = useRef<HTMLDivElement>(null);

  const department = tabs.find((tab) => tab.id === active);

  return (
    <section aria-labelledby="picked-heading">
      {/* ---- Explore your interests ----
          A centred uppercase heading over one scrolling row of outlined pills,
          the marketplace-reference opening. The active pill takes a heavier
          black edge rather than a fill, so the row stays calm above the grid. */}
      <h2
        id="picked-heading"
        className="tile-type phone-gutter mb-3 text-center text-[18px] font-bold uppercase tracking-[0.02em] text-[#111] md:mb-4 md:text-[22px]"
      >
        Explore your interests
      </h2>
      <div className="relative mb-3 md:mb-4">
        <div
          ref={rowRef}
          className="tile-type phone-gutter no-scrollbar flex items-center gap-2.5 overflow-x-auto md:gap-4 md:pr-12"
        >
          <button
            type="button"
            onClick={() => setActive(FOR_YOU)}
            aria-pressed={active === FOR_YOU}
            className={`shrink-0 rounded-full px-5 py-2.5 text-[14px] leading-tight transition-colors ${
              active === FOR_YOU
                ? "border-2 border-[#222] font-semibold text-[#222]"
                : "border border-[#999] text-[#333] hover:border-[#222]"
            }`}
          >
            Recommended
          </button>

          {newest.length > 0 && (
            <button
              type="button"
              onClick={() => setActive(NEW_IN)}
              aria-pressed={active === NEW_IN}
              className={`shrink-0 rounded-full px-5 py-2.5 text-[14px] leading-tight transition-colors ${
              active === NEW_IN
                ? "border-2 border-[#222] font-semibold text-[#222]"
                : "border border-[#999] text-[#333] hover:border-[#222]"
            }`}
            >
              New in
            </button>
          )}

          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              aria-pressed={active === tab.id}
              className={`shrink-0 rounded-full px-5 py-2.5 text-[14px] leading-tight transition-colors ${
              active === tab.id
                ? "border-2 border-[#222] font-semibold text-[#222]"
                : "border border-[#999] text-[#333] hover:border-[#222]"
            }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="More interests"
          onClick={() => rowRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
          className="absolute right-0 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#ccc] bg-white text-[#222] hover:border-[#222] md:flex"
        >
          <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* Each endless grid is keyed, so switching between them starts the
          other's own listing rather than carrying pages loaded for this one. */}
      {active === NEW_IN ? (
        <InfiniteProducts key={NEW_IN} initialProducts={newest} totalPages={latestTotalPages} />
      ) : active === FOR_YOU || !department ? (
        <InfiniteProducts key={FOR_YOU} initialProducts={latest} totalPages={latestTotalPages} />
      ) : (
        <>
          {/* The same six-column ramp `InfiniteProducts` lays out, and it has to
              stay the same: two grids of different column counts under one tab
              row is the page re-laying itself out every time a chip is tapped.
              If that ramp moves, this moves with it. */}
          <ul className={PRODUCT_GRID}>
            {department.products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>

          <div className="phone-gutter mt-8 flex justify-center">
            <Link
              href={department.slug ? `/category/${department.slug}` : "/categories"}
              className="rounded-lg border border-shop-line px-8 py-2.5 text-[13px] text-shop-ink transition-colors hover:border-shop-primary hover:text-shop-primary"
            >
              Everything in {department.title}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
