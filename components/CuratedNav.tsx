"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryNode, Product } from "@/lib/woocommerce";
import { findCategorySlug, findDepartment } from "@/lib/departments";
import { formatPrice } from "@/lib/currency";

/**
 * The curated top-level nav, with a mega menu under each department.
 *
 * Hand-written rather than generated from the WooCommerce category tree. That
 * tree is whatever the catalogue happens to contain — on this shop it rendered
 * "Formal Shoes" and "Shoes" twice each — and a shop's main nav is a
 * merchandising decision, not a database listing. The full tree stays one click
 * away under "All Categories".
 *
 * `match` entries resolve to the real WooCommerce category of that name when one
 * exists. When it does not — a shop with no Kids department yet — the link falls
 * back to a search for the word, so the nav can never point at a dead category
 * page. Create the category in WordPress and the link upgrades itself.
 *
 * ---- The panel ----
 *
 * Hovering or focusing a department opens a panel listing what is actually
 * inside it, in columns, plus a strip of the products selling fastest in that
 * department. Two things are worth writing down about it:
 *
 * **Every entry is a real destination.** The columns are built from the
 * department's own children, so the menu cannot advertise a category the shop
 * does not have. Anything without a category behind it falls through to a
 * search for the same words — which is why tapping any entry always lands on
 * results rather than a 404.
 *
 * **The products load on demand.** Fetching best sellers for nine departments in
 * the layout would put nine catalogue reads in front of every page in the shop,
 * to fill a panel most visits never open. They are fetched the first time a
 * department is opened and then cached for the life of the page, so a second
 * hover is instant and a department never opened costs nothing.
 */
const NAV: { label: string; href?: string; match?: string; hot?: boolean }[] = [
  { label: "Super Deals", href: "/sale", hot: true },
  { label: "New Arrivals", href: "/search?sort=newest" },
  { label: "Best Sellers", href: "/search?sort=popular" },
  { label: "Men", match: "men" },
  { label: "Women", match: "women" },
  { label: "Kids", match: "kids" },
  { label: "Home & Living", match: "home" },
  { label: "Electronics", match: "electronics" },
  { label: "Beauty", match: "beauty" },
  { label: "Top Brands", href: "/sellers" },
];

// The matcher moved to lib/departments.ts: the homepage fills its Men, Women
// and Kids rails from the same words, and a rail that resolved a department
// differently from the link above it would send shoppers somewhere other than
// the products they had just been shown.

/** How many best sellers the panel shows. Four fits one row beside the columns. */
const PANEL_PRODUCTS = 4;

/** How the columns are filled — at most this many links before a new column. */
const PER_COLUMN = 6;

export default function CuratedNav({
  departments,
  className = "",
}: {
  departments: CategoryNode[];
  className?: string;
}) {
  /** The label of the department whose panel is open, or null for none. */
  const [open, setOpen] = useState<string | null>(null);

  /**
   * Best sellers per department slug, filled in as panels are opened.
   *
   * `undefined` means never fetched, `[]` means fetched and the department is
   * empty — the two need telling apart or an empty department would be
   * re-requested on every hover.
   */
  const [topSellers, setTopSellers] = useState<Record<string, Product[]>>({});

  /**
   * Closing is delayed by a beat.
   *
   * The panel sits below the link with a gap the pointer has to cross, and
   * closing on `mouseleave` the instant the pointer left the label made the menu
   * impossible to reach — it vanished halfway down. The timer gives the pointer
   * time to arrive; entering the panel cancels it.
   */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  // Escape closes the panel, the way every other menu on the site behaves.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /** Fetch the department's best sellers once, the first time it is opened. */
  const loadTopSellers = useCallback(
    async (slug: string) => {
      if (!slug || topSellers[slug] !== undefined) return;
      // Claim the slot immediately so a fast hover in and out cannot start the
      // same request twice.
      setTopSellers((current) => ({ ...current, [slug]: [] }));

      try {
        const response = await fetch(
          `/api/products?category=${encodeURIComponent(slug)}&sort=popular&per_page=${PANEL_PRODUCTS}`
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { products: Product[] };
        setTopSellers((current) => ({ ...current, [slug]: payload.products }));
      } catch {
        // A panel with no product strip is a working panel; the columns are the
        // part that matters and they are already rendered.
      }
    },
    [topSellers]
  );

  return (
    <div
      /* Scrolls sideways on a phone, where the row is wider than the screen,
         and stops scrolling from `lg` up, where it fits.

         The switch matters because an `overflow-x: auto` box also clips its
         children vertically — the browser computes `overflow-y` as `auto` the
         moment one axis is scrollable — so leaving it on would cut the mega
         panel off at the height of the nav bar. It is only ever needed below
         `lg`, and the panel is only ever opened by a hover, which is a pointer
         the small screens do not have. */
      className={`relative flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar lg:overflow-x-visible ${className}`}
      onMouseLeave={scheduleClose}
    >
      {NAV.map((entry) => {
        const department = entry.match ? findDepartment(departments, entry.match) : null;
        const slug = entry.match ? findCategorySlug(departments, entry.match) : null;
        const href =
          entry.href ??
          (slug ? `/category/${slug}` : `/search?q=${encodeURIComponent(entry.match ?? "")}`);

        // Only a department with children has anything to put in a panel. The
        // three curated links (Super Deals, New Arrivals, Top Brands) are
        // destinations, not departments, and open nothing.
        const children = department?.children ?? [];
        const hasPanel = children.length > 0;
        const isOpen = open === entry.label;

        return (
          <div
            key={entry.label}
            className="shrink-0"
            onMouseEnter={() => {
              cancelClose();
              if (hasPanel) {
                setOpen(entry.label);
                if (department) loadTopSellers(department.slug);
              } else {
                setOpen(null);
              }
            }}
          >
            <Link
              href={href}
              aria-expanded={hasPanel ? isOpen : undefined}
              aria-haspopup={hasPanel ? "true" : undefined}
              onFocus={() => {
                if (hasPanel) {
                  setOpen(entry.label);
                  if (department) loadTopSellers(department.slug);
                }
              }}
              /* Bold, in ink rather than slate.

                 These were 500 in `--color-shop-body`, which put the shop's
                 whole department nav a shade lighter and a weight lighter than
                 the product titles underneath it — so the eye landed on the grid
                 first and the way to navigate it second. At 700 in near-black
                 the row reads as the primary navigation it is.

                 The deal link is still the one entry that is a claim about
                 price rather than a place, so it still gets a colour of its
                 own. That colour is the brand's deep orange rather than sale
                 red now — red across the shop means "something is wrong", and
                 the deal language everywhere else (the corner flags, the Super
                 Deal chips, reduced prices) moved to `shop-primary-ink` with
                 it. See the corner-flag note in `ProductCard`. */
              className={`relative flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-2.5 text-[14.5px] font-bold transition-colors ${
                entry.hot
                  ? "text-shop-primary-ink"
                  : isOpen
                    ? "text-shop-flame"
                    : "text-shop-ink hover:text-shop-flame"
              }`}
            >
              {entry.label}
              {hasPanel && (
                <svg
                  aria-hidden
                  className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              )}
              {entry.hot && (
                <span className="absolute -right-1 -top-0.5 rounded-full rounded-bl-none bg-shop-primary-ink px-1.5 py-px text-[9px] font-bold leading-tight text-white">
                  HOT
                </span>
              )}
            </Link>

            {hasPanel && isOpen && department && (
              <MegaPanel
                department={department}
                products={topSellers[department.slug] ?? []}
                onNavigate={() => setOpen(null)}
                onMouseEnter={cancelClose}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The dropdown itself.
 *
 * Full-bleed across the nav rather than tucked under its own label: a department
 * with thirty sub-categories needs the width, and a panel that hangs off one
 * word looks like a tooltip rather than a section of the shop.
 */
function MegaPanel({
  department,
  products,
  onNavigate,
  onMouseEnter,
}: {
  department: CategoryNode;
  products: Product[];
  onNavigate: () => void;
  onMouseEnter: () => void;
}) {
  /**
   * One column per sub-category, headed by its own name.
   *
   * This is the Brands For Less structure and it is the right one because it
   * matches how the catalogue is actually filed: Men → Shoes → Boots, Flats,
   * School Shoes. The middle level is the column heading and the level below it
   * is the list, so the panel shows the shopper the shape of the department
   * rather than a flat alphabet of everything in it.
   *
   * A sub-category with nothing under it still gets a column — a heading on its
   * own, which is a link like any other. Departments whose children are all
   * childless therefore degrade into a plain row of links rather than breaking.
   */
  const columns = department.children;

  return (
    <div
      onMouseEnter={onMouseEnter}
      /* `left-0 right-0` against the nav's own `relative`, so the panel spans
         the navigation bar regardless of which label opened it. `z-50` clears
         the sticky masthead above it. */
      className="absolute left-0 right-0 top-full z-50 border-t border-shop-line bg-white shadow-[0_12px_28px_-12px_rgb(0_0_0/0.25)]"
    >
      <div className="mx-auto flex max-w-[var(--shell)] gap-8 px-6 py-6">
        {/* ---- The categories ---- */}
        <div className="min-w-0 flex-1">
          {/* Always a way to see the whole department, not only its parts. */}
          <Link
            href={`/category/${department.slug}`}
            onClick={onNavigate}
            className="mb-4 inline-flex items-center gap-1 text-[14px] font-bold text-shop-ink underline-offset-4 hover:text-shop-flame hover:underline"
          >
            View all {department.name}
            <svg aria-hidden className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
            </svg>
          </Link>

          <div className="flex flex-wrap gap-x-10 gap-y-6">
            {columns.map((child) => (
              <div key={child.id} className="min-w-[150px]">
                {/* The sub-category heads its own column and is itself a link —
                    a shopper who wants all of Shoes should not have to pick one
                    kind of shoe to get there. */}
                <Link
                  href={`/category/${child.slug}`}
                  onClick={onNavigate}
                  className="block border-b border-shop-hairline pb-1.5 text-[13.5px] font-bold text-shop-ink transition-colors hover:text-shop-flame"
                >
                  {child.name}
                </Link>

                {child.children.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {child.children.slice(0, PER_COLUMN).map((grandchild) => (
                      <li key={grandchild.id}>
                        <Link
                          href={`/category/${grandchild.slug}`}
                          onClick={onNavigate}
                          className="block text-[13px] text-shop-body transition-colors hover:text-shop-flame"
                        >
                          {grandchild.name}
                        </Link>
                      </li>
                    ))}
                    {child.children.length > PER_COLUMN && (
                      <li>
                        <Link
                          href={`/category/${child.slug}`}
                          onClick={onNavigate}
                          className="block text-[13px] font-semibold text-shop-flame hover:underline"
                        >
                          View all
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ---- Selling fastest ----
             The merchandising half of the panel. A menu that lists only
             category names asks the shopper to guess what is behind each one;
             four photographs of what is actually moving in this department
             answers it, and gives somebody who opened the menu without a plan
             something to click.

             Rendered only once the fetch has returned — an empty strip would
             otherwise reserve 260px of blank panel on every open. */}
        {products.length > 0 && (
          <div className="hidden w-[300px] shrink-0 border-l border-shop-hairline pl-8 xl:block">
            <p className="mb-3 flex items-center justify-between text-[13px] font-bold text-shop-ink">
              Selling fastest
              <Link
                href={`/category/${department.slug}?sort=popular`}
                onClick={onNavigate}
                className="text-[12px] font-semibold text-shop-flame hover:underline"
              >
                See all
              </Link>
            </p>
            <ul className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.slug || product.id}`}
                    onClick={onNavigate}
                    className="group block"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-[4px] border border-shop-line bg-white">
                      {/* Guarded: a product with no photograph stores "" and
                          `next/image` treats an empty src as a request for the
                          current page. */}
                      {product.image && (
                        <Image
                          src={product.image}
                          alt=""
                          fill
                          sizes="130px"
                          className="object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-tight text-shop-body">
                      {product.name}
                    </p>
                    <p className="price mt-0.5 text-[13px] text-shop-ink">
                      {formatPrice(product.price)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
