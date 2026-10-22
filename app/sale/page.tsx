import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductsSafe, type Product } from "@/lib/woocommerce";
import { sortProducts, toProductQuery } from "@/lib/sort-products";
import { discountPercent, formatPrice } from "@/lib/currency";
import { breadcrumbJsonLd, collectionJsonLd, productPath } from "@/lib/seo";
import SortDropdown from "@/components/SortDropdown";
import SaleBoard from "@/components/SaleBoard";
import InfiniteProducts from "@/components/home/InfiniteProducts";
import SaleCountdown from "@/components/SaleCountdown";
import { PRODUCT_GRID } from "@/lib/product-grid";

export const metadata = {
  title: "Black November Deals | Super Deals",
  description:
    "Shop genuine reductions and discover more in-stock November picks at KandiUg. Compare prices and check delivery options at checkout.",
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
 * The colours are the homepage shelf colours. `SaleBoard` paints each on its
 * band's header stub and on the jump chip that links to it.
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
  const [{ products, total, total_pages }, novemberPicks] = await Promise.all([
    getProductsSafe({ on_sale: true, page, per_page: 48, ...toProductQuery({ sort }) }),
    getProductsSafe({ per_page: 48, sort: "popular", in_stock: true }),
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

  /* The three deepest cuts on the first page, shown large before the board.
     Only in the default order and only when there is a board under them worth
     the space — a chosen sort is the shopper's own order, left alone. */
  const spotlight =
    !sort && products.length >= 6
      ? [...products]
          .sort(
            (a, b) =>
              discountPercent(b.regular_price, b.price) - discountPercent(a.regular_price, a.price)
          )
          .slice(0, 3)
      : [];
  const biggestSaving = products.reduce(
    (best, product) => Math.max(best, product.regular_price - product.price),
    0
  );
  /* Jump chips only for bands this page actually has. */
  const tierChips = sort
    ? []
    : TIERS.filter((tier, index) =>
        products.some((product) => {
          const cut = discountPercent(product.regular_price, product.price);
          const ceiling = index === 0 ? Infinity : TIERS[index - 1].min;
          return cut >= tier.min && cut < ceiling;
        })
      );

  return (
    <main className="mx-auto w-full max-w-[var(--shell)] px-0 pb-24 pt-3 md:px-8 lg:pb-10">
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

      <nav className="phone-gutter mb-3 flex items-center gap-2 text-[12px] text-shop-muted">
        <Link href="/" className="hover:text-shop-ink">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="text-shop-ink">Super Deals</span>
      </nav>

      {/* ---- The header: brand yellow, the deepest cut, and the clock ----
           Every figure here is counted off the products below it, never
           asserted: the deepest cut, how many are live, the biggest single
           saving. The clock counts to midnight, when prices are rechecked. */}
      <section className="relative mb-4 overflow-hidden bg-gradient-to-br from-[#ffe066] via-[#ffd23f] to-[#ffb800] px-4 py-5 md:rounded-3xl md:px-7 md:py-7">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/25"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/15"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ffcc00]">
              <svg aria-hidden className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
              </svg>
              Super Deals
            </p>
            <h1 className="mt-3 text-[30px] font-extrabold leading-[1.05] text-[#111111] md:text-[44px]">
              {deepest > 0 ? (
                <>
                  Up to <span className="text-[#c62828]">{deepest}% off</span>
                </>
              ) : (
                "Every reduced price"
              )}
            </h1>
            <p className="mt-2 max-w-[48ch] text-[14px] leading-relaxed text-[#3d3200]">
              {total > 0
                ? "Real reductions, rechecked every day. When a deal is gone, it is gone."
                : "Nothing is reduced at the moment. New deals are added as prices change."}
            </p>
            {total > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold text-[#111111]">
                <li className="rounded-full bg-white/80 px-3 py-1.5">
                  🔥 {total} {total === 1 ? "deal" : "deals"} live
                </li>
                {biggestSaving > 0 && (
                  <li className="rounded-full bg-white/80 px-3 py-1.5">
                    Save up to {formatPrice(biggestSaving)}
                  </li>
                )}
                <li className="rounded-full bg-white/80 px-3 py-1.5">Pay on delivery</li>
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-white/85 px-4 py-3 shadow-[0_8px_24px_rgba(122,90,0,0.18)]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7a5a00]">
              Today&apos;s prices end in
            </p>
            <SaleCountdown />
          </div>
        </div>
      </section>

      <div className="phone-gutter mb-5">
        <a href="#november-picks" className="inline-flex items-center gap-3 rounded-full border border-shop-line px-4 py-2 text-[12px] font-semibold text-shop-ink hover:border-shop-primary">Browse more November picks <span aria-hidden>&darr;</span></a>
      </div>

      {/* ---- Spotlight: the three deepest cuts, large ---- */}
      {spotlight.length === 3 && (
        <section aria-labelledby="top-deals" className="phone-gutter mb-5">
          <h2 id="top-deals" className="mb-3 text-[18px] font-extrabold text-shop-ink md:text-[20px]">
            Top 3 deals today
          </h2>
          <ol className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {spotlight.map((product, index) => (
              <li key={product.id} className="w-[72%] shrink-0 snap-start md:w-auto">
                <SpotlightCard product={product} rank={index + 1} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ---- Jump chips and sort ---- */}
      <div className="phone-gutter mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
          {tierChips.length > 1 ? (
            tierChips.map((tier) => (
              <a
                key={tier.id}
                href={`#deals-${tier.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-shop-line bg-white px-3 py-1.5 text-[13px] font-semibold text-shop-ink transition-colors hover:border-shop-ink"
              >
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: tier.shelf }} />
                {tier.title}
              </a>
            ))
          ) : (
            <p className="text-[13px] text-shop-muted">
              <span className="font-semibold text-shop-ink">{total}</span>{" "}
              {total === 1 ? "deal" : "deals"}
            </p>
          )}
        </div>
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
          perPage={48}
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

      <section id="november-picks" aria-labelledby="november-picks-heading" className="mt-8 scroll-mt-24">
        <div className="phone-gutter mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-shop-primary-ink">Discover more this November</p>
          <h2 id="november-picks-heading" className="mt-1 text-[20px] font-bold text-shop-ink">More November picks</h2>
          <p className="mt-1 text-[12px] text-shop-muted">More in-stock products to explore. Discounted items show their original price and saving.</p>
        </div>
        <InfiniteProducts initialProducts={novemberPicks.products} totalPages={novemberPicks.total_pages} perPage={48} query={{ sort: "popular", inStock: true }} doneLabel="You have seen all November picks." />
      </section>
    </main>
  );
}

/**
 * One of the three spotlight deals: a large photo with the cut on a ribbon,
 * the price in red over the original, what it saves, and a button.
 */
function SpotlightCard({ product, rank }: { product: Product; rank: number }) {
  const cut = discountPercent(product.regular_price, product.price);
  return (
    <Link
      href={productPath(product)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-shop-edge transition-shadow hover:shadow-[0_10px_28px_rgba(0,0,0,0.10)]"
    >
      <span className="relative block aspect-[4/3] bg-[#f6f6f7]">
        {product.image && (
          <Image
            src={product.image}
            alt=""
            fill
            priority={rank === 1}
            sizes="(max-width: 768px) 72vw, 33vw"
            className="object-contain p-3 mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.04]"
          />
        )}
        <span className="absolute left-0 top-3 rounded-r-full bg-[#c62828] py-1 pl-3 pr-4 text-[16px] font-extrabold leading-none text-white shadow-sm">
          -{cut}%
        </span>
        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#111111] text-[12px] font-bold text-[#ffcc00]">
          #{rank}
        </span>
      </span>
      <span className="flex flex-1 flex-col p-3.5">
        <span className="line-clamp-2 text-[14px] leading-snug text-shop-body">{product.name}</span>
        <span className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="price text-[20px] leading-none text-[#c62828]">{formatPrice(product.price)}</span>
          <s className="text-[13px] text-shop-faint">{formatPrice(product.regular_price)}</s>
        </span>
        <span className="mt-1.5 text-[12px] font-semibold text-shop-save">
          You save {formatPrice(product.regular_price - product.price)}
        </span>
        <span className="mt-auto pt-3">
          <span className="flex items-center justify-center rounded-xl bg-[#ffcc00] py-2.5 text-[14px] font-bold text-[#111111] transition-colors group-hover:bg-[#ffd633]">
            Grab this deal
          </span>
        </span>
      </span>
    </Link>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="phone-gutter"><div className="rounded-2xl border border-dashed border-shop-line bg-white px-6 py-20 text-center">
      <p className="text-[18px] font-extrabold text-shop-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-[44ch] text-[14px] leading-relaxed text-shop-muted">{copy}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/search?sort=newest" className="btn-shop px-7 py-2.5 text-[14px]">
          See what is new
        </Link>
        <Link href="/" className="btn-shop-outline px-7 py-2.5 text-[14px]">
          Back to the shop
        </Link>
      </div>
    </div></div>
  );
}
