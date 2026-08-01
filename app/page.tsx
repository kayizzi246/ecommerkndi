import Link from "next/link";
import { getCategories, getProductsSafe } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";
import FlashSaleCountdown from "@/components/FlashSaleCountdown";
import RecentlyViewed from "@/components/RecentlyViewed";

export default async function Home() {
  const [categories, onSale, latest] = await Promise.all([
    getCategories(),
    getProductsSafe({ on_sale: true, per_page: 8 }),
    getProductsSafe({ per_page: 12 }),
  ]);

  return (
    <main className="pb-24 lg:pb-12">
      <div className="border-b border-black/10 bg-[#efede8] px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-black md:px-8">
        Complimentary delivery on orders over UGX 50,000 · Secure local payment
      </div>

      <section className="border-b border-black/10 bg-[#d8d0c2]">
        <div className="mx-auto grid max-w-[1440px] md:grid-cols-2">
          <div className="flex min-h-[430px] flex-col justify-end px-6 py-12 md:min-h-[560px] md:px-12 lg:px-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/60">
              The Kandi edit · August 2026
            </p>
            <h1 className="mt-4 max-w-xl font-heading text-5xl font-semibold leading-[0.88] text-black md:text-7xl">
              The new
              <br />
              essentials.
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-6 text-black/70">
              Elevated finds for the way you live, move and show up—curated for every day in Uganda.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#new-arrivals" className="bg-black px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-black/75">
                Shop new arrivals
              </Link>
              <Link href="/sale" className="border border-black px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-black hover:text-white">
                Explore sale
              </Link>
            </div>
          </div>
          <div className="relative min-h-[300px] border-t border-black/10 bg-[#b9ab98] md:min-h-0 md:border-l md:border-t-0">
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="aspect-square w-4/5 border border-black/25" />
              <p className="absolute max-w-[13rem] text-center font-heading text-3xl font-semibold leading-none text-black md:text-5xl">
                Everyday,
                <br />
                refined.
              </p>
            </div>
            <p className="absolute bottom-5 right-6 text-[10px] uppercase tracking-[0.18em] text-black/60">Kandi Collection 01</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        {categories.length > 0 && (
          <section className="border-b border-black/10 py-9 md:py-12">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Shop by mood</p>
                <h2 className="mt-2 font-heading text-3xl font-semibold">Choose your edit</h2>
              </div>
              <Link href="/sale" className="hidden text-[10px] font-semibold uppercase tracking-[0.15em] underline underline-offset-4 sm:block">View all collections</Link>
            </div>
            <div className="grid grid-cols-2 border-l border-t border-black/10 sm:grid-cols-4 lg:grid-cols-6">
              {categories.slice(0, 6).map((cat, index) => (
                <Link key={cat.id} href={`/category/${cat.slug}`} className="group min-h-36 border-b border-r border-black/10 p-4 transition-colors hover:bg-[#efede8] md:min-h-44 md:p-5">
                  <span className="text-[10px] text-gray-500">0{index + 1}</span>
                  <span className="mt-10 block font-heading text-xl font-semibold leading-none group-hover:underline underline-offset-4">{cat.name}</span>
                  <span className="mt-3 block text-[10px] uppercase tracking-[0.14em] text-gray-500">Discover →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {onSale.products.length > 0 && (
          <section className="border-b border-black/10 py-10 md:py-14">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a13b2a]">Private sale</p>
                <h2 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">Selected pieces, considered prices.</h2>
              </div>
              <div className="border border-black px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]">Ends in <FlashSaleCountdown /></div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
              {onSale.products.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
            <Link href="/sale" className="mt-8 inline-block border-b border-black pb-1 text-[10px] font-semibold uppercase tracking-[0.16em]">Shop the sale</Link>
          </section>
        )}

        <RecentlyViewed />

        {latest.products.length > 0 && (
          <section id="new-arrivals" className="py-10 md:py-14">
            <div className="mb-7 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Just arrived</p>
                <h2 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">New in, for now.</h2>
              </div>
              <Link href="/search" className="hidden border-b border-black pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:block">View all</Link>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {latest.products.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
