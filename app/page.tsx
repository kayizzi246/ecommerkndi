import Link from "next/link";
import { getCategories, getProductsSafe } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";
import FlashSaleCountdown from "@/components/FlashSaleCountdown";

const CATEGORY_ICONS = ["👟", "👗", "👜", "🧢", "⌚", "🧴", "🏠", "📱"];

export default async function Home() {
  const [categories, onSale, latest] = await Promise.all([
    getCategories(),
    getProductsSafe({ on_sale: true, per_page: 8 }),
    getProductsSafe({ per_page: 12 }),
  ]);

  const storeEmpty = latest.products.length === 0;

  return (
    <main>
      {/* Benefits bar */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 md:gap-10 px-4 py-2.5 text-sm font-semibold whitespace-nowrap overflow-x-auto">
          <span className="flex items-center gap-2">🚚 Free Delivery in Kampala*</span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-2">↩️ Easy Returns</span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-2">✅ 100% Authentic</span>
        </div>
      </div>

      {/* SUPER PRICE hero */}
      <section className="bg-sale text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 text-center relative overflow-hidden">
          <p className="absolute top-6 left-8 text-5xl opacity-20 rotate-[-12deg] hidden md:block">👟</p>
          <p className="absolute top-16 right-10 text-5xl opacity-20 rotate-12 hidden md:block">👜</p>
          <p className="absolute bottom-8 left-24 text-5xl opacity-20 rotate-6 hidden md:block">⌚</p>
          <p className="absolute bottom-6 right-28 text-5xl opacity-20 rotate-[-8deg] hidden md:block">👗</p>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-wide">
            SUPER PRICE
          </h1>
          <p className="text-lg md:text-2xl mt-3">Unmissable Daily Deals</p>
          <p className="text-4xl md:text-6xl font-extrabold mt-4">
            UP TO 80% OFF
          </p>
          <Link
            href="/sale"
            className="inline-block mt-8 bg-sun text-black font-extrabold uppercase tracking-wide px-12 py-3.5 hover:brightness-95"
          >
            Shop now
          </Link>
        </div>
      </section>

      {/* Category columns */}
      {categories.length > 0 && (
        <section className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto grid grid-flow-col auto-cols-fr divide-x divide-gray-200 overflow-x-auto">
            {categories.slice(0, 5).map((cat, i) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="flex items-center justify-center gap-3 py-6 text-lg md:text-2xl font-semibold hover:bg-gray-50"
              >
                <span className="text-2xl">{CATEGORY_ICONS[i % CATEGORY_ICONS.length]}</span>
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Promo circles */}
        <section className="flex gap-6 md:gap-10 overflow-x-auto py-8 md:justify-center">
          {[
            {
              href: "/sale",
              circle: (
                <span className="bg-sale text-white font-extrabold text-center leading-tight text-sm">
                  FLAT
                  <br />
                  <span className="text-xl">40%</span>
                  <br />
                  OFF
                </span>
              ),
              label: "Shop Now",
              bg: "bg-sale",
            },
            {
              href: "/sale",
              circle: (
                <span className="text-white font-extrabold text-center leading-tight text-sm">
                  FLAT
                  <br />
                  <span className="text-xl">50%</span>
                  <br />
                  OFF
                </span>
              ),
              label: "Shop Now",
              bg: "bg-sale",
            },
            {
              href: "/sale",
              circle: (
                <span className="text-white font-extrabold text-center leading-tight text-sm">
                  SUPER
                  <br />
                  PRICE
                </span>
              ),
              label: "Up to 80% Off",
              bg: "bg-sale",
            },
            {
              href: "/#new-arrivals",
              circle: (
                <span className="text-black font-extrabold italic text-center leading-tight text-sm">
                  new
                  <br />
                  new
                  <br />
                  new
                </span>
              ),
              label: "Just Landed",
              bg: "bg-sun",
            },
            ...categories.slice(0, 4).map((cat, i) => ({
              href: `/category/${cat.slug}`,
              circle: (
                <span className="text-4xl">
                  {CATEGORY_ICONS[i % CATEGORY_ICONS.length]}
                </span>
              ),
              label: cat.name,
              bg: "bg-orange-50",
            })),
          ].map((item, i) => (
            <Link key={i} href={item.href} className="shrink-0 text-center group">
              <span
                className={`${item.bg} w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center mx-auto group-hover:scale-105 transition-transform`}
              >
                {item.circle}
              </span>
              <span className="block mt-2 text-sm font-semibold">{item.label}</span>
            </Link>
          ))}
        </section>

        {storeEmpty && (
          <section className="border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-600 mb-10">
            <p className="font-bold mb-2">No products to show yet</p>
            <p className="text-sm">
              Check that <code className="bg-gray-100 px-1">WP_API_URL</code> in{" "}
              <code className="bg-gray-100 px-1">.env.local</code> points to your
              WordPress site and that the Kandi Store API snippet is active.
            </p>
          </section>
        )}

        {/* Second promo banner */}
        <section className="bg-[#1a3fa0] text-white rounded-sm mb-12">
          <div className="px-6 md:px-16 py-12 md:py-16 flex flex-col md:flex-row items-center gap-8">
            <p className="text-7xl md:text-8xl">👟</p>
            <div className="text-center md:text-left flex-1">
              <p className="font-bold tracking-[0.2em] uppercase">Move in style</p>
              <p className="text-3xl md:text-5xl font-extrabold text-sun mt-2">
                UP TO 85% OFF
              </p>
              <p className="mt-2 text-blue-100">
                Sale ends in <FlashSaleCountdown />
              </p>
            </div>
            <Link
              href="/sale"
              className="bg-black text-white font-bold uppercase tracking-wide px-10 py-3.5 rounded-full hover:bg-gray-900 shrink-0"
            >
              Shop now
            </Link>
          </div>
        </section>

        {/* Top-selling brands (categories as brand cards) */}
        {categories.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl md:text-2xl font-extrabold uppercase tracking-wide text-center mb-6">
              Top-Selling Brands
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.slice(0, 12).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="border border-gray-200 rounded-sm h-24 flex items-center justify-center text-lg font-bold hover:shadow-md transition-shadow text-center px-3"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recommended for you */}
        {onSale.products.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl md:text-2xl font-extrabold text-center mb-6">
              Recommended For You
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
              {onSale.products.map((product) => (
                <div key={product.id} className="w-56 md:w-64 shrink-0 snap-start">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* New arrivals */}
        {latest.products.length > 0 && (
          <section id="new-arrivals" className="mb-12">
            <h2 className="text-xl md:text-2xl font-extrabold text-center mb-6">
              New Arrivals
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
              {latest.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Shop tiles */}
        {categories.length > 0 && (
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-16">
            {categories.slice(0, 5).map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="relative bg-gray-900 text-white h-36 md:h-44 flex items-end justify-center pb-5 rounded-sm overflow-hidden group"
              >
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-gray-700 group-hover:from-black transition-colors" />
                <span className="relative font-bold uppercase tracking-widest text-sm">
                  Shop {cat.name}
                </span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
