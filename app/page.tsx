import Link from "next/link";
import { getCategories, getProductsSafe } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";
import DealCarousel from "@/components/DealCarousel";
import FlashSaleCountdown from "@/components/FlashSaleCountdown";
import RecentlyViewed from "@/components/RecentlyViewed";

/** The four reassurance points, colour-coded like the Temu value strip. */
const VALUE_PROPS = [
  { label: "Free delivery", detail: "on orders over UGX 50,000", tone: "text-pop-green-on-dark" },
  { label: "Pay on delivery", detail: "cash, MoMo or Airtel Money", tone: "text-pop-blue-on-dark" },
  { label: "14-day returns", detail: "change your mind, free", tone: "text-pop-violet-on-dark" },
  { label: "100% authentic", detail: "international brands only", tone: "text-pop-orange-on-dark" },
];

export default async function Home() {
  const [categories, onSale, featured, latest] = await Promise.all([
    getCategories(),
    getProductsSafe({ on_sale: true, per_page: 12 }),
    getProductsSafe({ featured: true, per_page: 12 }),
    getProductsSafe({ per_page: 18 }),
  ]);

  // Trending leads the page. Featured products are the shop's own picks; when
  // none are flagged in WooCommerce the newest stock stands in, so the rail is
  // never empty on a fresh catalogue.
  const trending = (featured.products.length > 0 ? featured.products : latest.products).slice(0, 12);
  // Rails can hold more than a grid row could, since they scroll.
  const deals = onSale.products.slice(0, 12);
  const newIn = latest.products.slice(0, 12);
  const grid = latest.products.slice(0, 15);

  // A rail standing alone gets the full row, so its tiles narrow to keep the
  // same physical size rather than stretching to fill it.
  const paired = deals.length > 0 && newIn.length > 0;
  const railItemWidth = paired
    ? "w-[44%] sm:w-[30%]"
    : "w-[44%] sm:w-[22%] lg:w-[15.5%]";

  return (
    <main className="pb-24 lg:pb-12">
      {/* Value strip */}
      <div className="bg-shop-nav">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 md:grid-cols-4 md:px-8">
          {VALUE_PROPS.map((prop) => (
            <div key={prop.label} className="flex flex-col">
              <span className={`text-[13px] font-black leading-tight ${prop.tone}`}>
                {prop.label}
              </span>
              <span className="text-[11px] leading-tight text-white/60">{prop.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        {/* ---- Trending, first thing on the page ---- */}
        {trending.length > 0 && (
          <section className="pt-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h1 className="flex items-center gap-2.5 text-[26px] font-black uppercase italic leading-none tracking-tight text-shop-ink md:text-[32px]">
                <span className="not-italic">🔥</span>
                <span className="bg-gradient-to-r from-pop-red to-pop-orange bg-clip-text text-transparent">
                  Trending now
                </span>
              </h1>
              <Link
                href="#all-products"
                className="text-[13px] font-bold text-shop-body hover:text-shop-ink"
              >
                See all ›
              </Link>
            </div>

            <DealCarousel products={trending} tone="red" />
          </section>
        )}

        {/* ---- Deal rails, Temu style. They pair up when both have stock;
             with nothing on sale the surviving rail takes the full width
             rather than leaving half the row empty. ---- */}
        <div
          className={`mt-9 grid gap-5 ${
            deals.length > 0 && newIn.length > 0 ? "lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {deals.length > 0 && (
            <section className="rounded-xl bg-pop-orange-soft p-4 md:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[20px] font-black uppercase leading-none tracking-tight text-pop-orange md:text-[24px]">
                  Lightning deals
                </h2>
                <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-pop-red">
                  Ends in <FlashSaleCountdown />
                </span>
              </div>
              <DealCarousel
                products={deals}
                tone="orange"
                itemWidth={railItemWidth}
              />
              <Link
                href="/sale"
                className="mt-4 block rounded-full bg-pop-orange py-2.5 text-center text-[13px] font-bold text-white transition-opacity hover:opacity-90"
              >
                Shop all deals
              </Link>
            </section>
          )}

          {newIn.length > 0 && (
            <section className="rounded-xl bg-pop-blue-soft p-4 md:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[20px] font-black uppercase leading-none tracking-tight text-pop-blue md:text-[24px]">
                  Just landed
                </h2>
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-pop-blue">
                  New this week
                </span>
              </div>
              <DealCarousel
                products={newIn}
                tone="blue"
                itemWidth={railItemWidth}
              />
              <Link
                href="#all-products"
                className="mt-4 block rounded-full bg-pop-blue py-2.5 text-center text-[13px] font-bold text-white transition-opacity hover:opacity-90"
              >
                Browse new arrivals
              </Link>
            </section>
          )}
        </div>

        {/* ---- Explore your interests ---- */}
        {categories.length > 0 && (
          <section className="pt-10">
            <h2 className="mb-4 text-center text-[22px] font-black uppercase tracking-tight text-shop-ink md:text-[26px]">
              Explore your interests
            </h2>
            <div className="flex flex-wrap justify-center gap-2.5">
              {categories.slice(0, 12).map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="rounded-full border border-shop-line bg-white px-5 py-2.5 text-[13px] font-bold text-shop-body transition-colors hover:border-shop-primary hover:bg-shop-primary hover:text-white"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ---- The one banner on the page ---- */}
        <Link
          href="/sale"
          className="mt-10 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl bg-gradient-to-r from-pop-red to-pop-orange px-6 py-6 text-white transition-opacity hover:opacity-95 md:px-10"
        >
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/80">
              Super Price Store
            </p>
            <p className="mt-1.5 text-[26px] font-black leading-none md:text-[36px]">
              Up to 80% off RRP
            </p>
          </div>
          <span className="rounded-full bg-white px-7 py-3 text-[14px] font-black text-pop-red">
            Shop now ›
          </span>
        </Link>

        <RecentlyViewed />

        {/* ---- Everything else ---- */}
        {grid.length > 0 && (
          <section id="all-products" className="mt-12">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-[22px] font-black uppercase tracking-tight text-shop-ink md:text-[26px]">
                Picked for you
              </h2>
              <Link href="/search" className="text-[13px] font-bold text-shop-body hover:text-shop-ink">
                View all ›
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {grid.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* ---- Sell with us ---- */}
        <section className="mt-14 flex flex-wrap items-center justify-between gap-5 rounded-xl bg-pop-green-soft px-6 py-7">
          <div>
            <h2 className="text-[20px] font-black text-pop-green">Sell your brand on Kandi</h2>
            <p className="mt-1 text-[13px] text-shop-body">
              No listing fees, nationwide delivery and weekly payouts. Set up in minutes.
            </p>
          </div>
          <Link
            href="/seller/register"
            className="rounded-full bg-pop-green px-8 py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Become a seller
          </Link>
        </section>
      </div>
    </main>
  );
}
