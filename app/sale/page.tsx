import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductsSafe } from "@/lib/woocommerce";
import { sortProducts, toProductQuery } from "@/lib/sort-products";
import { discountPercent, formatPrice } from "@/lib/currency";
import { getSiteSettings } from "@/lib/site-settings";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import ProductCard from "@/components/ProductCard";
import SortDropdown from "@/components/SortDropdown";
import Pagination from "@/components/Pagination";
import FlashSaleCountdown from "@/components/FlashSaleCountdown";

export const metadata = {
  title: "Super Price Store",
  description:
    "Everything currently reduced on Kandi — the biggest discounts in the shop, updated as prices change. Pay on delivery across Uganda.",
  // Page 2 and beyond of the same list, and every sort order of it, are the
  // same products in a different arrangement. They all point back here so the
  // ranking lands on one URL instead of being split across a dozen.
  alternates: { canonical: "/sale" },
};

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

  return (
    <main className="mx-auto w-full max-w-[var(--shell)] px-3 pb-24 pt-4 md:px-8 lg:pb-12">
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

      {/* ---- Hero ----
           Every figure here is counted from the products below: how many are
           reduced, the deepest cut, the total the whole page saves. The old
           version was a red block with a headline and nothing to back it up.

           ---- And it is no longer red ----

           This was `from-shop-sale via-[#c62828] to-[#8e1a1a]` — the largest
           red object on the site, on the page whose entire subject is a
           reduction. That made it the last thing contradicting the rule the
           palette now states: red means something is wrong, and the deal
           language is the brand's deep orange. See the note on
           `--color-shop-sale` in `globals.css`.

           The ramp is the brand's own, dark end first, so a page of orange
           deal flags below sits inside the same family rather than against a
           second one. White type still clears AA on every stop of it. */}
      <section className="relative mb-6 overflow-hidden rounded-none bg-gradient-to-br md:rounded-2xl from-shop-ember via-shop-primary-ink to-[#7a3200] px-5 py-7 text-white md:px-10 md:py-9">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/12 blur-3xl"
        />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/80">
              Super Price Store
            </p>
            <h1 className="heading-black mt-1.5 text-[30px] leading-[1.05] md:text-[46px]">
              {deepest > 0 ? `Up to ${deepest}% off` : "Every reduced price"}
            </h1>
            <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-white/85">
              {total > 0
                ? `${total} ${total === 1 ? "product is" : "products are"} reduced right now. Prices are rechecked every day — what is here today may not be tomorrow.`
                : "Nothing is reduced at the moment. New deals are added as prices change."}
            </p>

            <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-white/90">
              {[
                `FREE delivery over ${formatPrice(settings.commerce.free_delivery_from)}`,
                "Pay on delivery",
                `${settings.commerce.returns_days}-day returns`,
              ].map((line) => (
                <li key={line} className="flex items-center gap-1.5">
                  <svg aria-hidden className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            {saved > 0 && (
              <Figure label="Saved on this page" value={formatPrice(saved)} />
            )}
            <div className="rounded-xl bg-white px-5 py-3 text-center text-shop-ink">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-shop-muted">
                Prices refresh in
              </p>
              <p className="price mt-1 text-[22px] leading-none">
                <FlashSaleCountdown />
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Result bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-shop-line pb-3.5">
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
        <>
          {/* Seven across at the widest. This page carries no filter rail, so it
              has a couple of hundred pixels more to spend than search or a
              category — and on a page of markdowns the shopper is comparing,
              which means seeing as many at once as stay legible. */}
          {/* 8/16 on a phone, 12/24 from sm — the shared product-grid rhythm.
              See the note in the category grid for why the old 1px gaps drew
              nothing on a white page. */}
          <div className="grid grid-cols-2 gap-x-1.5 gap-y-3 sm:grid-cols-3 md:gap-x-3 md:gap-y-5 md:grid-cols-5">
            {sorted.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pagination basePath="/sale" page={page} totalPages={total_pages} params={{ sort }} />
        </>
      )}
    </main>
  );
}

/** One figure in the hero, for numbers the page can prove. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-5 py-3 text-center backdrop-blur-sm">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-white/75">{label}</p>
      <p className="price mt-1 text-[22px] leading-none text-white">{value}</p>
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
