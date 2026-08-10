import { getCategories, getProductsSafe } from "@/lib/woocommerce";
import DealCarousel from "@/components/DealCarousel";
import CategoryChips from "@/components/home/CategoryChips";
import PromoTiles from "@/components/home/PromoTiles";
import SuperDeals from "@/components/home/SuperDeals";
import SectionHeader from "@/components/home/SectionHeader";
import WideBanner from "@/components/home/WideBanner";
import InfiniteProducts from "@/components/home/InfiniteProducts";
import TrustBar from "@/components/home/TrustBar";
import { getSiteSettings } from "@/lib/site-settings";

export default async function Home() {
  const [settings, categories, onSale, featured, latest] = await Promise.all([
    getSiteSettings(),
    getCategories(),
    getProductsSafe({ on_sale: true, per_page: 12 }),
    getProductsSafe({ featured: true, per_page: 12 }),
    getProductsSafe({ per_page: 24 }),
  ]);

  const deals = onSale.products.slice(0, 5);

  // Trending is the shop's own picks where any are flagged, newest otherwise.
  // "Picked for you" below is the whole catalogue, so overlap there is expected
  // and fine — it is the endless grid, not a curated rail.
  const trendingPool = featured.products.length > 0 ? featured.products : latest.products;
  const trending = trendingPool.slice(0, 12);

  return (
    <main className="pb-20">
      {/* The hero banner and the category card grid used to open the page. Both
          are gone: a fashion storefront opens on merchandise, and the chips
          below carry the departments in one line instead of a screen. */}
      {/* Section spacing steps up with the window rather than sitting at one
          value: 28px is comfortable on a phone, where the same gap that reads
          as generous on a desktop reads as a hole. */}
      <div className="mx-auto flex max-w-[1450px] flex-col gap-7 px-4 py-5 md:gap-9 md:px-8">
        <CategoryChips categories={categories} />

        <PromoTiles />

        {trending.length > 0 && (
          <section id="trending" className="scroll-mt-32">
            <SectionHeader title="Trending now" href="/search?sort=popular" />
            <DealCarousel products={trending} />
          </section>
        )}

        <SuperDeals products={deals} />

        <WideBanner
          eyebrow={settings.banner.eyebrow}
          headline={settings.banner.headline}
          href={settings.banner.cta_url}
          cta={settings.banner.cta_label}
        />

        <section>
          <SectionHeader title="Picked for you" />
          <InfiniteProducts
            initialProducts={latest.products}
            totalPages={latest.total_pages}
          />
        </section>

        <TrustBar />
      </div>
    </main>
  );
}
