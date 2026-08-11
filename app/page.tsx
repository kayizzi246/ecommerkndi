import { getCategories, getProductsSafe, getStores } from "@/lib/woocommerce";
import DealCarousel from "@/components/DealCarousel";
import CategoryChips from "@/components/home/CategoryChips";
import PromoTiles from "@/components/home/PromoTiles";
import SuperDeals from "@/components/home/SuperDeals";
import DailyDeals from "@/components/home/DailyDeals";
import SectionHeader from "@/components/home/SectionHeader";
import WideBanner from "@/components/home/WideBanner";
import InfiniteProducts from "@/components/home/InfiniteProducts";
import TrustBar from "@/components/home/TrustBar";
import SellWithUs from "@/components/home/SellWithUs";
import { getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";
import type { Metadata } from "next";

/**
 * The homepage is canonical to itself, and says so explicitly.
 *
 * Not inherited from the layout any more: metadata set there applies to every
 * page under it, which is how every policy page ended up claiming to be this
 * one. The title and description still come from the layout, where they are
 * built from the shop's wp-admin branding.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [settings, categories, onSale, featured, latest, stores] = await Promise.all([
    getSiteSettings(),
    getCategories(),
    // Enough on-sale stock for both discount sections: Super Deals takes the
    // first five, Daily Deals carries the rest.
    getProductsSafe({ on_sale: true, per_page: 24 }),
    getProductsSafe({ featured: true, per_page: 12 }),
    getProductsSafe({ per_page: 24 }),
    // Only for the seller band's store count. Returns [] on an older plugin, so
    // the band simply drops the figure rather than the page failing.
    getStores(),
  ]);

  const deals = onSale.products.slice(0, 6);
  const dailyDeals = onSale.products.slice(6, 22);

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
          value: on a phone 20px is enough to separate two sections, and the gap
          that reads as generous on a desktop reads as a hole there. The side
          padding goes the same way — 12px on a phone is the difference between
          a grid and a grid with a margin around it. */}
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-3 py-4 md:gap-9 md:px-8 md:py-5">
        <CategoryChips categories={categories} />

        <PromoTiles />

        {trending.length > 0 && (
          <section id="trending" className="scroll-mt-32">
            <SectionHeader title="Trending now" href="/search?sort=popular" />
            <DealCarousel products={trending} />
          </section>
        )}

        {/* Deals sit directly under Trending: the rail above is what is popular,
            this is what is cheap today, and those are the two reasons a shopper
            keeps scrolling a homepage. */}
        <DailyDeals products={dailyDeals} fallback={latest.products} />

        <SuperDeals products={deals} />

        {/* The offer wording is the shop's own, from wp-admin. The three lines
            under it are not copywriting — they are the shop's real terms, read
            straight out of settings, so the banner cannot promise a threshold
            or a returns window the checkout does not honour. */}
        <WideBanner
          eyebrow={settings.banner.eyebrow}
          headline={settings.banner.headline}
          href={settings.banner.cta_url}
          cta={settings.banner.cta_label}
          reasons={[
            `FREE delivery over ${formatPrice(settings.commerce.free_delivery_from)}`,
            "Pay on delivery",
            `${settings.commerce.returns_days}-day free returns`,
          ]}
        />

        <section>
          <SectionHeader title="Picked for you" />
          <InfiniteProducts
            initialProducts={latest.products}
            totalPages={latest.total_pages}
          />
        </section>

        <TrustBar />

        {/* Recruiting sellers at the foot of the page, after a shopper has seen
            what the shop looks like — the trader worth having is the one who
            liked the catalogue first. */}
        <SellWithUs settings={settings} storeCount={stores.length} />
      </div>
    </main>
  );
}
