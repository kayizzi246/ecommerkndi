"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { formatPrice } from "@/lib/currency";
import type { ProductCategory } from "@/lib/woocommerce";

type Brand = { slug: string; name: string; count: number };

/** How many categories the browse list shows before the "Show all" button. */
const CATEGORY_PREVIEW = 8;

type Props = {
  /** Brand facet, counted from the products on the page. */
  brands?: Brand[];
  /**
   * The shop's whole category list, flat, exactly as WooCommerce holds it —
   * every department, every shelf under it, every shelf under that, with its
   * `parent` and its `count`.
   *
   * ---- Why the whole list, and not the facet ----
   *
   * The panel used to head the `brands` facet "Category", and that facet is
   * counted from the two dozen products on the CURRENT PAGE. On a fashion
   * department of four hundred items, page one happens to contain dresses and
   * two kinds of shoe, so the "Category" filter offered a shopper three
   * choices out of the thirty the shop actually has — and the three changed
   * every time they turned the page.
   *
   * This is the fix, and it has to come from the tree rather than from the
   * products: a category with no stock on page one is still a category, and a
   * shopper looking for handbags needs to see Handbags whether or not one
   * happens to be in the first twenty-four rows.
   */
  categories?: ProductCategory[];
  /** The category being browsed, when there is one — `/category/[slug]`. */
  currentSlug?: string;
  onClose?: () => void;
  className?: string;
};

/**
 * Listing filters. Every control here maps to a query parameter that
 * `filterProducts` understands, so nothing in this panel is decorative.
 */
export default function FilterSidebar({
  brands = [],
  categories = [],
  currentSlug,
  onClose,
  className = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMin = searchParams.get("min_price") ?? "";
  const currentMax = searchParams.get("max_price") ?? "";
  const inStockOnly = searchParams.get("stock") === "1";
  const onSaleOnly = searchParams.get("sale") === "1";
  const currentBrand = searchParams.get("brand") ?? "";

  const [localMin, setLocalMin] = useState(currentMin);
  const [localMax, setLocalMax] = useState(currentMax);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const applyFilters = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    ["min_price", "max_price", "stock", "sale", "brand", "page"].forEach((key) =>
      params.delete(key)
    );
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    onClose?.();
  }, [router, pathname, searchParams, onClose]);

  /* ---- Which slice of the tree this panel shows ----

     A panel listing all thirty of the shop's categories at every depth is a
     sitemap, not a filter — the shopper has to read the whole shop to find the
     shelf next to where they already are. So it answers one question: "what
     else is near here?"

       - Browsing a department (Fashion) → its shelves, and where a shelf has
         shelves of its own, those too, printed under it as a group. That is
         the list the old facet was failing to produce, and one level was not
         enough to produce it: this shop files Fashion → Women → Dresses, so a
         shopper in Fashion who was shown only Men / Women / Kids had learned
         nothing they did not know from the word they clicked.
       - Browsing a leaf shelf (Boots) → its SIBLINGS, plus a way back up. A
         shopper in Boots is choosing between Boots, Heels and Flats; showing
         them the empty children of Boots would be showing them nothing.
       - Not browsing a category (search results) → the DEPARTMENTS, which is
         the right offer when the shopper has not picked a branch at all.

     Everything is a link to a real category page rather than a query
     parameter, because that is what it is: moving between categories is
     navigation, and dressing it as a checkbox would let a shopper tick two
     categories the URL cannot express. */
  const browse = useMemo(() => {
    const current = currentSlug
      ? categories.find((entry) => entry.slug === currentSlug)
      : undefined;

    /* Busiest first, and empty shelves dropped. A category ordered
       alphabetically puts "Accessories" above the shelf holding most of the
       department, and the count is the only signal here about where the stock
       actually is. A link to a shelf with nothing on it is a link to a
       disappointment — kept only when it is the page the shopper is on, so the
       list never appears to have lost the entry they are standing in. */
    const childrenOf = (id: number) =>
      categories
        .filter((entry) => (entry.parent ?? 0) === id)
        .filter((entry) => (entry.count ?? 0) > 0 || entry.slug === currentSlug)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

    const parent = current
      ? categories.find((entry) => entry.id === (current.parent ?? 0))
      : undefined;

    const top = current
      ? childrenOf(current.id).length > 0
        ? childrenOf(current.id)
        : childrenOf(current.parent ?? 0)
      : childrenOf(0);

    /* Two levels, and deliberately not three. Three is where this stops being
       a panel and becomes the ShelfIndex at the foot of /categories, which
       already exists and is a better place to read the whole tree. Six
       sub-shelves per group for the same reason — the group header is a link
       to the rest of them. */
    const groups = top.map((node) => ({
      node,
      children: childrenOf(node.id).slice(0, 6),
    }));

    return {
      current,
      parent,
      groups,
      /** Every link the panel would draw if nothing were collapsed. */
      total: groups.reduce((sum, group) => sum + 1 + group.children.length, 0),
    };
  }, [categories, currentSlug]);
  /* ---- Which of the facet's options are safe to offer ----
   *
   * The refinement is sent to WordPress as `category`, REPLACING the
   * department in the query — see the note in `toProductQuery`, which explains
   * why it cannot be sent alongside it. That makes this list load-bearing
   * rather than cosmetic: an option from outside the branch the shopper is
   * browsing would quietly move them out of it. Tick "New Arrivals" inside Men
   * and you would be looking at everyone's new arrivals.
   *
   * So on a category page the facet is cut to the DESCENDANTS of the category
   * being browsed. `brandFacets` builds it from the categories the loaded
   * products happen to carry, and a product carries all of them — its shelf,
   * its department, and any cross-cutting term the shop has tagged it with.
   * Only the ones under the current branch are a genuine narrowing of it.
   *
   * The current category is dropped too: refining Men to Men is a no-op that
   * looks like a filter.
   *
   * On search there is no branch to stay inside, so every option stands.
   */
  const refinements = useMemo(() => {
    if (!currentSlug) return brands;

    const byId = new Map(categories.map((entry) => [entry.id, entry]));
    const current = categories.find((entry) => entry.slug === currentSlug);
    if (!current) return brands;

    /* Walks up rather than down. Down would mean collecting the whole subtree
       per option; up is one chain per option and terminates at the root — and
       the depth cap is the guard against a malformed row whose parent chain
       loops, which `buildCategoryTree` also has to defend against. */
    const isUnder = (slug: string) => {
      let node = categories.find((entry) => entry.slug === slug);
      for (let depth = 0; node && depth < 8; depth += 1) {
        const parentId = node.parent ?? 0;
        if (parentId === current.id) return true;
        if (parentId === 0) return false;
        node = byId.get(parentId);
      }
      return false;
    };

    return brands.filter((brand) => isUnder(brand.slug));
  }, [brands, categories, currentSlug]);

  const activeCount =
    (currentMin ? 1 : 0) +
    (currentMax ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    (currentBrand ? 1 : 0);

  return (
    <aside className={`text-[14px] ${className}`}>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[16px] font-extrabold text-shop-ink">
          Filters{" "}
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-shop-primary px-2 py-0.5 text-[12px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[13px] text-shop-body underline underline-offset-4 hover:text-shop-ink"
            >
              Clear all
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="text-lg leading-none text-shop-muted hover:text-shop-ink"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ---- Shop by category ----

           First in the panel, above availability and price, because it is the
           only control here that changes WHICH products are being filtered
           rather than which of them survive. A shopper in the wrong department
           cannot be helped by a price range. */}
      {browse.groups.length > 0 && (
        <section className="border-t border-shop-line py-5">
          <h4 className="mb-1 text-[13px] font-extrabold uppercase tracking-[0.08em] text-shop-muted">
            {browse.current ? "Shop by category" : "Departments"}
          </h4>
          <p className="mb-3 text-[12px] leading-snug text-shop-muted">
            {browse.current
              ? `Everything in ${browse.current.name}, shelf by shelf.`
              : "Jump straight to a department."}
          </p>

          {/* The way back up. Without it a shopper who has drilled into Boots
              can reach Heels and Flats from this list but cannot reach Shoes,
              which is the one place they see all three at once. Named rather
              than an arrow alone — "All Shoes" says what is up there. */}
          {browse.parent && (
            <Link
              href={`/category/${browse.parent.slug}`}
              className="mb-2 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-shop-body transition-colors hover:bg-shop-surface hover:text-shop-ink"
            >
              <span aria-hidden>←</span>
              All {browse.parent.name}
            </Link>
          )}

          <ul className="space-y-2.5">
            {(showAllCategories
              ? browse.groups
              : browse.groups.slice(0, CATEGORY_PREVIEW)
            ).map((group) => (
              <li key={group.node.id}>
                <CategoryLink entry={group.node} currentSlug={currentSlug} />

                {/* The shelves inside the shelf. Indented under their parent and
                    a step smaller, so the two levels are told apart by shape
                    rather than by the shopper having to read them — which is the
                    whole reason this is a grouped list and not one flat one. */}
                {group.children.length > 0 && (
                  <ul className="mt-0.5 space-y-px border-l border-shop-line pl-2.5 ml-2.5">
                    {group.children.map((child) => (
                      <li key={child.id}>
                        <CategoryLink entry={child} currentSlug={currentSlug} small />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {/* Eight groups, then the rest on request. A fashion department can
              hold twenty shelves, and a panel that opens with twenty links is a
              panel a shopper scrolls past to reach the price box. The count in
              the label is of LINKS rather than of groups, because that is what
              the shopper is about to be shown. */}
          {browse.groups.length > CATEGORY_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllCategories((open) => !open)}
              className="mt-3 px-2.5 text-[13px] font-semibold text-shop-primary-ink underline underline-offset-4 hover:text-shop-ink"
            >
              {showAllCategories
                ? "Show fewer categories"
                : `Show all ${browse.total} categories`}
            </button>
          )}
        </section>
      )}

      {/* Availability */}
      <section className="border-t border-shop-line py-5">
        <h4 className="mb-3 text-[13px] font-extrabold uppercase tracking-[0.08em] text-shop-muted">
          Availability
        </h4>
        <label className="flex cursor-pointer items-center gap-2.5 py-1 text-shop-body">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={() => applyFilters({ stock: inStockOnly ? undefined : "1" })}
            className="h-4 w-4 rounded accent-shop-primary"
          />
          In stock only
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 py-1 text-shop-body">
          <input
            type="checkbox"
            checked={onSaleOnly}
            onChange={() => applyFilters({ sale: onSaleOnly ? undefined : "1" })}
            className="h-4 w-4 rounded accent-shop-primary"
          />
          On sale
        </label>
      </section>

      {/* Price */}
      <section className="border-t border-shop-line py-5">
        <h4 className="mb-3 text-[13px] font-extrabold uppercase tracking-[0.08em] text-shop-muted">
          Price
        </h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            placeholder="Min"
            aria-label="Minimum price"
            className="field-shop px-2.5 py-2 text-[14px]"
          />
          <span className="text-shop-muted">–</span>
          <input
            type="number"
            min={0}
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            placeholder="Max"
            aria-label="Maximum price"
            className="field-shop px-2.5 py-2 text-[14px]"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            applyFilters({
              min_price: localMin || undefined,
              max_price: localMax || undefined,
            })
          }
          className="btn-shop-outline mt-2.5 w-full py-2 text-[13px]"
        >
          Apply price
        </button>
        {(currentMin || currentMax) && (
          <p className="mt-2 text-[13px] text-shop-muted">
            Showing {currentMin ? formatPrice(Number(currentMin)) : "any"} –{" "}
            {currentMax ? formatPrice(Number(currentMax)) : "any"}
          </p>
        )}
      </section>

      {/* ---- Refine these results ----

           This is the `brands` facet, and its heading used to read "Category" —
           which is what made it look like the shop's category list and behave
           like a broken one. It is not that. It is counted from the products
           currently loaded, it filters them in place with `?brand=`, and the
           categories it names are whichever ones those products happen to
           carry. A genuinely useful control under a genuinely misleading label:
           the browse list above is where a shopper GOES to a category, and this
           is where they narrow the ones already in front of them.

           Hidden when it would offer one choice. A facet with a single option
           filters nothing, and under the old heading it read as a category list
           that had lost the rest of its entries — which is the exact confusion
           this section has just been renamed to end. */}
      {/* `|| currentBrand` is not belt-and-braces, it is the fix for the bug
           this section creates for itself. Once a refinement is applied the
           server returns only that category's products, so the facet counted
           off them offers exactly one option — the section would fail its own
           `> 1` test and vanish, taking the only way to switch the refinement
           off with it. It stays on screen for as long as one is active. */}
      {(refinements.length > 1 || currentBrand) && (
        <section className="border-t border-shop-line py-5">
          <h4 className="mb-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-shop-muted">
            Refine these results
          </h4>
          <p className="mb-2.5 text-[11px] leading-snug text-shop-muted">
            Narrows what is on screen now.
          </p>
          <ul className="max-h-64 space-y-px overflow-y-auto">
            {refinements.map((brand) => {
              const active = currentBrand === brand.slug;
              return (
                <li key={brand.slug}>
                  <button
                    type="button"
                    onClick={() => applyFilters({ brand: active ? undefined : brand.slug })}
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                      active
                        ? "bg-shop-primary-soft font-semibold text-shop-primary-ink"
                        : "text-shop-body hover:bg-shop-surface"
                    }`}
                  >
                    <span className="truncate">{brand.name}</span>
                    <span
                      className={`shrink-0 text-[11px] ${
                        active ? "text-shop-primary-ink/70" : "text-shop-muted"
                      }`}
                    >
                      {brand.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}

/**
 * One row in the browse list — a department, a shelf, or a shelf under a shelf.
 *
 * Extracted rather than inlined twice because the two levels differ only in
 * type size and weight, and the part that is easy to get wrong is the same in
 * both: `aria-current="page"` rather than a pressed state. This is a link to
 * where the shopper already is, not a toggle they can switch off, and a screen
 * reader told it is a pressed button will offer to press it again.
 *
 * The count is printed whenever WooCommerce sent one. It is the only thing in
 * this list that tells a shopper whether a shelf is worth opening, and its
 * absence is why the old page-scoped facet felt arbitrary — three categories
 * with no sense of which one held the stock.
 */
function CategoryLink({
  entry,
  currentSlug,
  small = false,
}: {
  entry: ProductCategory;
  currentSlug?: string;
  small?: boolean;
}) {
  const here = entry.slug === currentSlug;

  return (
    <Link
      href={`/category/${entry.slug}`}
      aria-current={here ? "page" : undefined}
      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
        small ? "text-[13px]" : "text-[14px] font-semibold"
      } ${
        here
          ? "bg-shop-primary-soft font-bold text-shop-primary-ink"
          : "text-shop-body hover:bg-shop-surface hover:text-shop-ink"
      }`}
    >
      <span className="truncate">{entry.name}</span>
      {(entry.count ?? 0) > 0 && (
        <span
          className={`shrink-0 text-[12px] ${
            here ? "text-shop-primary-ink/70" : "text-shop-muted"
          }`}
        >
          {entry.count}
        </span>
      )}
    </Link>
  );
}
