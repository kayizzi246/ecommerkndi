"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function PickedForYou({
  latest,
  latestTotalPages,
  tabs,
}: {
  latest: Product[];
  latestTotalPages: number;
  tabs: PickedTab[];
}) {
  const [active, setActive] = useState(FOR_YOU);

  const department = tabs.find((tab) => tab.id === active);

  return (
    <section aria-labelledby="picked-heading">
      {/* ---- The tab row ----

          Scrolls rather than wraps, for the same reason the channel strip does:
          six chips on two lines is a block of navigation sitting where the first
          row of products should be. The heading rides the row rather than
          sitting above it, which is what keeps the whole thing to one line. */}
      <div className="no-scrollbar mb-3 flex items-center gap-2 overflow-x-auto border-b border-shop-line pb-2.5">
        <h2
          id="picked-heading"
          className="mr-1 shrink-0 text-[15px] font-bold text-shop-ink md:text-[17px]"
        >
          You might like
        </h2>

        <button
          type="button"
          onClick={() => setActive(FOR_YOU)}
          aria-pressed={active === FOR_YOU}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            active === FOR_YOU
              ? "bg-shop-primary text-white"
              : "bg-shop-surface text-shop-body hover:bg-shop-primary-soft hover:text-shop-primary-ink"
          }`}
        >
          For you
        </button>

        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            aria-pressed={active === tab.id}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              active === tab.id
                ? "bg-shop-primary text-white"
                : "bg-shop-surface text-shop-body hover:bg-shop-primary-soft hover:text-shop-primary-ink"
            }`}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {active === FOR_YOU || !department ? (
        <InfiniteProducts initialProducts={latest} totalPages={latestTotalPages} />
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

          <div className="mt-8 flex justify-center">
            <Link
              href={department.slug ? `/category/${department.slug}` : "/categories"}
              className="rounded-lg border border-shop-line px-8 py-2.5 text-[14px] text-shop-ink transition-colors hover:border-shop-primary hover:text-shop-primary"
            >
              Everything in {department.title}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
