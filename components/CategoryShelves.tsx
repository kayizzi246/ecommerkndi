"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import DealCarousel from "@/components/DealCarousel";

/**
 * One shelf, flattened for the client.
 *
 * `slugs` is the shelf's own slug plus every slug beneath it, computed on the
 * server where the tree is. A shelf like "Shoes" usually holds nothing
 * directly — the products are filed under "Sneakers", "Boots", "Sandals" — so
 * matching on the shelf slug alone would leave every tab empty on a shop that
 * files things properly. Sending the subtree down is cheaper than sending the
 * whole tree and reading it again here.
 */
export type Shelf = {
  name: string;
  slug: string;
  slugs: string[];
};

/**
 * A department, as a heading, a row of shelf tabs and one rail.
 *
 * ---- Why the tabs are buttons and not links ----
 *
 * A tab that navigates is not a tab, it is a menu — and a menu is what this
 * page used to be. The point of the change is that a shopper can stand in one
 * place and see the actual goods on four shelves without four page loads,
 * which is the thing a list of category names cannot do however well it is
 * laid out.
 *
 * The links those tabs would have been are not lost. Every shelf and every
 * sub-shelf is still linked from the index at the foot of the page, which is
 * where a crawler reads the tree from — see the note on it in `page.tsx`.
 *
 * ---- Why the filtering happens here rather than on the server ----
 *
 * The alternative is one request per shelf, and this page has about twenty of
 * them across four departments. The department's own feed already carries each
 * product's full category list, so a shelf is a filter over data the page has
 * in hand rather than a round trip — four requests for the page instead of
 * twenty-four, and switching tabs then costs nothing at all.
 *
 * The cost is that a tab can only show what came back in the department's
 * feed. That is why shelves with no hits are dropped rather than rendered as
 * tabs that lead nowhere: a tab a shopper taps to find nothing is worse than a
 * tab that was never offered.
 */
export default function CategoryShelves({
  name,
  slug,
  shelves,
  products,
  priority = false,
}: {
  name: string;
  slug: string;
  shelves: Shelf[];
  products: Product[];
  /** Set on the first department only — see `DealCarousel`. */
  priority?: boolean;
}) {
  const buckets = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const shelf of shelves) {
      const wanted = new Set(shelf.slugs);
      const hits = products.filter((product) =>
        product.categories.some((category) => wanted.has(category.slug))
      );
      if (hits.length > 0) map.set(shelf.slug, hits);
    }
    return map;
  }, [shelves, products]);

  const tabs = useMemo(
    () => shelves.filter((shelf) => buckets.has(shelf.slug)),
    [shelves, buckets]
  );

  /** `null` is the "All" tab, which is the department's whole feed. */
  const [active, setActive] = useState<string | null>(null);

  const shown = active ? buckets.get(active) ?? [] : products;
  const shownSlug = active ?? slug;
  const activeName = tabs.find((shelf) => shelf.slug === active)?.name;

  if (products.length === 0) return null;

  return (
    <section aria-labelledby={`dept-${slug}-title`} id={`dept-${slug}`} className="scroll-mt-28">
      {/* The heading row. The department name is the largest thing in the
          section because it is the landmark a shopper scrolling this page is
          looking for — they are not reading the page, they are looking for
          where their things live. Same treatment as the homepage's department
          rails, deliberately: these are the same objects, and inventing a
          second style for them here would make one shop look like two. */}
      <div className="phone-gutter flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`dept-${slug}-title`} className="heading-black text-[22px] text-shop-ink md:text-[26px]">
            {name}
          </h2>
          <p className="section-sub mt-1 truncate text-[13px]">
            {shown.length} {shown.length === 1 ? "product" : "products"}
            {activeName
              ? ` in ${activeName}`
              : tabs.length > 0
                ? ` across ${tabs.length} ${tabs.length === 1 ? "shelf" : "shelves"}`
                : ""}
          </p>
        </div>

        {/* Follows the tab. A shopper who has narrowed to Shoes and wants the
            rest of them means the rest of the SHOES — sending them to the
            department would undo the one choice they just made. */}
        <Link
          href={`/category/${shownSlug}`}
          className="shrink-0 rounded-full bg-shop-primary px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-shop-primary-dark"
        >
          Shop all
        </Link>
      </div>

      {/* ---- The tabs ----

          A scroller on a phone and a wrap from md up. Home Decor has eight
          shelves, which is two lines of pills on a laptop and a horizontal
          scroll on a 390px screen — and scrolling is the right answer there,
          because wrapping eight pills onto three lines pushes the products
          themselves below the fold, which is the one thing this page is now
          for.

          The negative margin lets that scroll run edge to edge on a phone
          while the pills still line up with the heading above them. Without it
          the first pill starts 12px in and the last stops 12px short, which
          reads as a row that has been cut off rather than one that scrolls. */}
      {tabs.length > 0 && (
        <div
          role="tablist"
          aria-label={`${name} shelves`}
          /* The negative margin has gone with the page gutter it was
             cancelling — /categories runs at zero horizontal padding on a phone
             now, so this row reaches the edge by simply not being inset. The
             12px of `px-3` stays: it is what keeps the first pill lined up with
             the heading above it rather than hard against the glass. */
          className="mt-3 flex gap-2 overflow-x-auto px-3 pb-1 no-scrollbar md:flex-wrap md:px-0"
        >
          <Tab
            label="All"
            panelId={`dept-${slug}-panel`}
            active={active === null}
            onSelect={() => setActive(null)}
          />
          {tabs.map((shelf) => (
            <Tab
              key={shelf.slug}
              label={shelf.name}
              panelId={`dept-${slug}-panel`}
              count={buckets.get(shelf.slug)?.length}
              active={active === shelf.slug}
              onSelect={() => setActive(shelf.slug)}
            />
          ))}
        </div>
      )}

      <div id={`dept-${slug}-panel`} role={tabs.length > 0 ? "tabpanel" : undefined} className="mt-3">
        {/* Keyed on the tab so React rebuilds the track rather than reusing
            it. Without the key the rail keeps its scroll position across a tab
            change, so a shopper who has swiped halfway through Shoes taps
            Jewelry and lands in the middle of it — which reads as the tab
            having failed to do anything. */}
        <DealCarousel
          key={shownSlug}
          products={shown}
          priority={priority}
          viewAll={{
            href: `/category/${shownSlug}`,
            label: activeName ? `All ${activeName}` : `All ${name}`,
          }}
        />
      </div>
    </section>
  );
}

/**
 * One pill.
 *
 * The count rides inside it rather than in a column of its own, because the
 * row scrolls: a number that can be scrolled away from the name it belongs to
 * is a number attached to the wrong shelf.
 */
function Tab({
  label,
  panelId,
  count,
  active,
  onSelect,
}: {
  label: string;
  panelId: string;
  count?: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      onClick={onSelect}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? "border-shop-primary bg-shop-primary text-white"
          : "border-shop-line bg-white text-shop-body hover:border-shop-primary hover:text-shop-primary"
      }`}
    >
      {label}
      {typeof count === "number" && (
        <span
          className={`ml-1.5 text-[12px] tabular-nums ${active ? "text-white/70" : "text-shop-muted"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
