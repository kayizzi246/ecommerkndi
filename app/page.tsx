import Link from "next/link";
import { getCategories, getProductsSafe } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";
import ProductCarousel from "@/components/ProductCarousel";
import FlashSaleCountdown from "@/components/FlashSaleCountdown";
import RecentlyViewed from "@/components/RecentlyViewed";

const PROMO_TILES = [
  { title: "Up to 80% off", copy: "Super Price Store", href: "/sale", tone: "bg-bfl-red text-white" },
  { title: "New arrivals", copy: "Fresh drops every week", href: "/search", tone: "bg-black text-white" },
  { title: "Kids & babies", copy: "From UGX 15,000", href: "/category/kids", tone: "bg-bfl-yellow text-black" },
  { title: "Home & living", copy: "Refresh every room", href: "/category/home-living", tone: "bg-bfl-ink text-white" },
];

export default async function Home() {
  const [categories, onSale, latest] = await Promise.all([
    getCategories(),
    getProductsSafe({ on_sale: true, per_page: 10 }),
    getProductsSafe({ per_page: 12 }),
  ]);

  return (
    <main className="pb-24 lg:pb-12">
      {/* Announcement strip */}
      <div className="bg-bfl-yellow px-4 py-2 text-center text-[12px] font-bold text-black md:px-8">
        Free delivery on orders over UGX 50,000 · Pay on delivery across Uganda
      </div>

      {/* Hero */}
      <section className="bg-black">
        <div className="mx-auto grid max-w-[1440px] items-stretch md:grid-cols-[1.35fr_1fr]">
          <div className="flex min-h-[320px] flex-col justify-center px-6 py-12 md:min-h-[420px] md:px-12 lg:px-16">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-bfl-yellow">
              Big brands · Small prices
            </p>
            <h1 className="mt-4 max-w-2xl text-[38px] font-bold leading-[1.05] text-white md:text-[56px]">
              Original brands, up to 80% less.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-6 text-white/70">
              Shoes, fashion, sportswear and homeware from the labels you know — delivered anywhere
              in Uganda.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sale" className="btn-bfl px-8 py-3.5 text-[14px]">
                Shop the Super Price Store
              </Link>
              <Link
                href="#new-arrivals"
                className="border border-white/40 px-8 py-3.5 text-[14px] font-bold uppercase tracking-wide text-white transition-colors hover:border-bfl-yellow hover:text-bfl-yellow"
              >
                New arrivals
              </Link>
            </div>
          </div>

          <div className="relative flex min-h-[220px] items-center justify-center bg-bfl-yellow px-8 py-12">
            <div className="text-center">
              <p className="text-[64px] font-bold leading-none text-black md:text-[86px]">80%</p>
              <p className="mt-1 text-[18px] font-bold uppercase tracking-wide text-black">Off RRP</p>
              <p className="mt-3 flex items-center justify-center gap-2 text-[13px] font-bold text-black">
                Ends in <FlashSaleCountdown />
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        {/* Shop by department */}
        {categories.length > 0 && (
          <section id="categories" className="py-9">
            <h2 className="mb-6 text-center text-[26px] font-normal text-black">Shop by department</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar sm:justify-center">
              {categories.slice(0, 8).map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="group flex w-[92px] shrink-0 flex-col items-center gap-2 text-center"
                >
                  <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-bfl-surface text-[22px] font-bold text-bfl-ink transition-colors group-hover:bg-bfl-yellow group-hover:text-black">
                    {category.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-[12px] leading-tight text-[#333] group-hover:text-black">
                    {category.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Promo tiles */}
        <section className="grid gap-3 pb-9 sm:grid-cols-2 lg:grid-cols-4">
          {PROMO_TILES.map((tile) => (
            <Link
              key={tile.title}
              href={tile.href}
              className={`flex min-h-[130px] flex-col justify-end p-5 transition-opacity hover:opacity-90 ${tile.tone}`}
            >
              <p className="text-[20px] font-bold leading-tight">{tile.title}</p>
              <p className="mt-1 text-[13px] opacity-80">{tile.copy}</p>
            </Link>
          ))}
        </section>

        {/* Super price rail */}
        {onSale.products.length > 0 && (
          <section className="border-t border-bfl-line pt-9">
            <div className="mb-1 flex flex-wrap items-center justify-center gap-3">
              <span className="nav-slant bg-bfl-red px-6 py-1.5 text-[13px] font-bold text-white">
                Super Price Store
              </span>
            </div>
            <ProductCarousel title="Today's biggest savings" products={onSale.products} />
            <div className="mt-6 text-center">
              <Link href="/sale" className="btn-bfl inline-block px-8 py-3 text-[13px]">
                See all deals
              </Link>
            </div>
          </section>
        )}

        <RecentlyViewed />

        {/* New arrivals grid */}
        {latest.products.length > 0 && (
          <section id="new-arrivals" className="border-t border-bfl-line pt-9 mt-12">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-[26px] font-normal text-black">New arrivals</h2>
              <Link href="/search" className="link-bfl text-[13px] font-bold">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {latest.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Sell with us */}
        <section className="mt-14 flex flex-wrap items-center justify-between gap-5 border border-bfl-line bg-bfl-surface px-6 py-7">
          <div>
            <h2 className="text-[20px] font-bold text-black">Sell your brand on Kandi</h2>
            <p className="mt-1 text-[13px] text-bfl-grey">
              No listing fees, nationwide delivery and weekly payouts. Set up in minutes.
            </p>
          </div>
          <Link href="/seller/register" className="btn-bfl px-8 py-3 text-[13px]">
            Become a seller
          </Link>
        </section>
      </div>
    </main>
  );
}
