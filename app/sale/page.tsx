import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductsSafe } from "@/lib/woocommerce";
import { sortProducts, toProductQuery } from "@/lib/sort-products";
import { discountPercent, formatPrice } from "@/lib/currency";
import { getSiteSettings } from "@/lib/site-settings";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import SortDropdown from "@/components/SortDropdown";
import SaleBoard from "@/components/SaleBoard";
import FlashSaleCountdown from "@/components/FlashSaleCountdown";
import { PRODUCT_GRID } from "@/lib/product-grid";

export const metadata = {
  title: "Super Price Store",
  description:
    "Everything currently reduced on Kandi — the biggest discounts in the shop, updated as prices change. Pay on delivery across Uganda.",
  // Page 2 and beyond of the same list, and every sort order of it, are the
  // same products in a different arrangement. They all point back here so the
  // ranking lands on one URL instead of being split across a dozen.
  alternates: { canonical: "/sale" },
};

/**
 * ---- The deals are banded by how deep the cut is ----
 *
 * This page was one flat grid of everything on sale, in whatever order
 * WooCommerce returned, with a "Sort by" dropdown defaulting to "Best
 * match". That buried the one thing the page exists to answer. Somebody who
 * has clicked "Super Price Store" is not browsing a catalogue — they are
 * looking for the biggest reduction in the shop — and the biggest reduction
 * could sit anywhere in twenty tiles, findable only by knowing to change a
 * dropdown.
 *
 * Banding makes that answer structural rather than optional: the deepest
 * band is first, labelled with the figure it contains, and nobody has to
 * sort anything to see it.
 *
 * The titles ARE the fact, deliberately. "50% off and over" says exactly
 * what is in the band; "Top steals" would be the shop grading its own
 * homework.
 *
 * The colours are the homepage shelf colours, painted by the same
 * `.shop-panel-strong > .section-head` rule — so a band here is the same
 * object as a shelf there, not a second system that happens to resemble it.
 */
const TIERS: { id: string; min: number; title: string; shelf: string }[] = [
  { id: "half", min: 50, title: "50% off and over", shelf: "#b8123a" },
  { id: "big", min: 30, title: "30% to 49% off", shelf: "#7642d6" },
  { id: "rest", min: 1, title: "Up to 29% off", shelf: "#1e56bd" },
];

/**
 * Seven across at the widest. This page carries no filter rail, so it has a
 * couple of hundred pixels more to spend than search or a category — and on a
 * page of markdowns the shopper is comparing, which means seeing as many at
 * once as stay legible. 8/16 on a phone, 12/24 from sm: the shared
 * product-grid rhythm.
 */
const GRID =
  PRODUCT_GRID;

export default async function SalePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { page: pageParam, sort } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  // Sorted by WordPress across the whole sale, not within the page. The
  // `discount` option is the exception and stays local — WooCommerce cannot
  // order by the gap between two prices — so `sortProducts` still runs below.
  const [{ products, total, total_pages }, settings] = await Promise.all([
    getProductsSafe({ on_sale: true, page, per_page: 24, ...toProductQuery({ sort }) }),
    getSiteSettings(),
  ]);

  /**
   * There is no page 99 of the sale, and saying so is what a 404 is for.
   *
   * /sale?page=99 used to render the whole page — heading, countdown,
   * pagination — around an empty grid, which is a SOFT 404: a 200 answer with
   * nothing behind it. Search Console counts those against the site.
   *
   * Page 1 is exempt on purpose. An empty first page means nothing is on sale
   * today, which is a true and temporary state of a real page, not a URL that
   * was never valid.
   */
  if (page > 1 && products.length === 0) notFound();

  const sorted = sortProducts(products, sort);

  // Read off the page rather than asserted. "Up to 60% off" printed above a
  // grid whose best offer is 15% is the kind of thing shoppers check.
  const deepest = products.reduce(
    (best, product) => Math.max(best, discountPercent(product.regular_price, product.price)),
    0
  );
  const saved = products.reduce(
    (sum, product) => sum + Math.max(0, product.regular_price - product.price),
    0
  );

  /**
   * Banded only while the shopper has not asked for an order of their own.
   *
   * A chosen sort is an explicit instruction — "cheapest first", "newest
   * first" — and cutting that into three discount bands would quietly
   * override it: the cheapest thing on the page would sit in the third band,
   * under two others. So the bands are the DEFAULT arrangement, and choosing
   * a sort replaces them with the flat grid, which is what was asked for.
   */
  /* The banding itself moved into `SaleBoard`, and it had to: the bands are
     recomputed from every product on the board each time another page arrives,
     which is a client concern now that the board scrolls forever. `TIERS` is
     still declared here, beside the page that names them, and passed in.

     What is kept above is the argument for WHY a chosen sort replaces the
     bands rather than reordering within them. `SaleBoard` applies the same
     rule; this is where it is explained. */

  return (
    <main className="mx-auto w-full max-w-[var(--shell)] px-3 pb-24 pt-3 md:px-8 lg:pb-10">
      {/* The highest-converting page on the shop, and it carried no structured
          data at all — so the one page whose entire content is discounted stock
          was the page Google understood least. The breadcrumb places it, the
          ItemList names what is on it. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Super Price Store", path: "/sale" },
            ]),
            collectionJsonLd("Super Price Store", "/sale", sorted),
          ]),
        }}
      />

      {/* Breadcrumbs */}
      <nav className="mb-4 flex items-center gap-2 text-[13px] text-shop-muted">
        <Link href="/" className="hover:text-shop-ink">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="text-shop-ink">Super Price Store</span>
      </nav>

      {/* ---- The header, where a 250px orange slab used to be ----

           The slab was a brand gradient carrying an eyebrow, a 46px
           headline, a paragraph, three delivery ticks and two figure boxes —
           the largest object on the page, sitting above a page whose entire
           subject is the products underneath it.

           Everything it said that was TRUE is still here, and still counted
           off those products: the deepest cut in the headline, how many are
           reduced, what the whole page saves, and the countdown. What has
           gone is the ground it said them on. The colour moved down to the
           band headers, where it now means something — how deep the cut is —
           instead of being a decorative field behind a heading.

           The three delivery ticks went with it. They are on every product
           page in this shop beside the price, in the footer, and in the
           announcement strip at the top of this very page. A fourth telling
           was spending the best space on the page on terms nobody came here
           to read. */}
      <section className="mb-4 rounded-2xl bg-shop-panel px-3.5 py-3.5 shadow-[inset_0_0_0_1px_var(--color-shop-line)] md:px-5 md:py-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-shop-flame">
              Super Price Store
            </p>
            <h1 className="heading-black mt-1 text-[26px] leading-[1.08] text-shop-ink md:text-[34px]">
              {deepest > 0 ? `Up to ${deepest}% off` : "Every reduced price"}
            </h1>
            <p className="mt-1.5 max-w-[54ch] text-[14px] leading-relaxed text-shop-body">
              {total > 0
                ? `${total} ${total === 1 ? "product is" : "products are"} reduced right now. Prices are rechecked every day — what is here today may not be tomorrow.`
                : "Nothing is reduced at the moment. New deals are added as prices change."}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {saved > 0 && (
              <Figure label="You would save" value={formatPrice(saved)} />
            )}
            <Figure label="Prices refresh in" value={<FlashSaleCountdown />} />
          </div>
        </div>
      </section>

      {/* Result bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-shop-line pb-3">
        <p className="text-[14px] text-shop-muted">
          Showing <span className="font-semibold text-shop-ink">{sorted.length}</span> of {total}{" "}
          {total === 1 ? "deal" : "deals"}
        </p>
        <SortDropdown />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No deals running right now"
          copy="Nothing is reduced at the moment. The shop's newest stock is still worth a look."
        />
      ) : (
        <SaleBoard
          initialProducts={sorted}
          totalPages={total_pages}
          /* The page the server rendered. Almost always 1 — /sale no longer
             produces numbered URLs — but `?page=` is still honoured above for
             the links already in Google and in people's history, and the board
             carries on from wherever that landed rather than re-fetching a page
             the shopper is already looking at. */
          startPage={page}
          sort={sort}
          tiers={TIERS}
          gridClassName={GRID}
        />
      )}
    </main>
  );
}

/**
 * One figure in the header, for numbers the page can prove.
 *
 * `ReactNode` rather than `string`: the countdown is a client component and
 * used to need a differently-styled box of its own beside these, so the
 * header carried two kinds of tile saying the same kind of thing.
 */
function Figure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-shop-hairline px-4 py-2.5 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wide text-shop-muted">
        {label}
      </p>
      <p className="price mt-0.5 text-[19px] leading-none text-shop-ink">{value}</p>
    </div>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-shop-line bg-white px-6 py-20 text-center">
      <p className="text-[19px] font-extrabold text-shop-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-[44ch] text-[15px] leading-relaxed text-shop-muted">{copy}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/search?sort=newest" className="btn-shop px-7 py-2.5 text-[15px]">
          See what is new
        </Link>
        <Link href="/" className="btn-shop-outline px-7 py-2.5 text-[15px]">
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
