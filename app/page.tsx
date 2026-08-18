import { buildHomeFeed, MIN_RAIL } from "@/lib/home-feed";
import DepartmentRail from "@/components/home/DepartmentRail";
import DealCarousel from "@/components/DealCarousel";
import HeroBanner from "@/components/home/HeroBanner";
import SuperDeals from "@/components/home/SuperDeals";
import SectionHeader from "@/components/home/SectionHeader";
import InfiniteProducts from "@/components/home/InfiniteProducts";
import RecentlyViewed from "@/components/RecentlyViewed";
import TrustBar from "@/components/home/TrustBar";
import SellWithUs from "@/components/home/SellWithUs";
import { brandName, getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";
import Link from "next/link";
import type { Metadata } from "next";

/**
 * The homepage is canonical to itself, and says so explicitly.
 *
 * Not inherited from the layout any more: metadata set there applies to every
 * page under it, which is how every policy page ended up claiming to be this
 * one.
 *
 * ---- Why the title is written by hand here ----
 *
 * It used to fall through to the layout's default, which is built from the
 * wp-admin branding and therefore read "Kandi For Less | Online Shopping in
 * Uganda…". That is the shop's registered name — but it is not what anybody
 * types. People search **kandi ug**, because that is the address they were
 * given and the name on the receipt, and until now the string "KandiUg"
 * appeared nowhere on this page: not in the title, not in the description, not
 * in a single visible sentence. The only place it existed was the
 * `alternateName` array in the site JSON-LD, which is a hint to Google, not
 * evidence. Google will not rank a page for a phrase the page never says.
 *
 * So the query leads the title and the registered name follows it. Both are
 * true, both are the same business, and now both are on the page.
 *
 * `title.absolute` rather than a plain string: a plain one would be run through
 * the layout's `%s | {brand}` template and come out with the brand twice.
 *
 * A function rather than a constant so the registered name still comes from
 * wp-admin — a shop that renames itself should not need a redeploy.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const brand = brandName(settings);

  return {
    alternates: { canonical: "/" },
    title: {
      absolute: `KandiUg — Online Shopping in Uganda | ${brand}`,
    },
    description:
      `KandiUg (${brand}) is a Ugandan online marketplace for shoes, fashion, ` +
      `electronics and home. Fast delivery countrywide, pay on delivery, ` +
      `${settings.commerce.returns_days}-day returns.`,
    openGraph: {
      type: "website",
      title: `KandiUg — Online Shopping in Uganda`,
      description:
        `Shop shoes, fashion, electronics and more on KandiUg. Fast delivery ` +
        `across Uganda, pay on delivery, ${settings.commerce.returns_days}-day returns.`,
      url: "/",
    },
  };
}

export default async function Home() {
  /**
   * Every rail on this page is composed in `lib/home-feed.ts`, not here.
   *
   * It moved there when the Flutter app started needing the same rails: the
   * ordering, the cut-offs and the no-product-appears-twice rule are
   * merchandising decisions, and a merchandising decision duplicated in two
   * places is a merchandising decision that will eventually disagree with
   * itself. This page renders the result; `/api/app/home` serialises the same
   * result for the app. Neither one decides anything.
   */
  const {
    settings,
    trending,
    sellerArrivals,
    promoProducts,
    deals,
    newArrivals,
    bestSellers,
    departmentRails,
    latest,
    latestTotalPages,
    storeCount,
    departmentMinimum,
  } = await buildHomeFeed();

  /** Brand plus suffix, spaced — for the closing about block. */
  const brand = brandName(settings);

  return (
    // White, like every other page in the shop.
    //
    // This carried an off-white ground for a while, on the argument that white
    // product tiles need something to sit on. In practice the separation was not
    // worth what it cost: most of this catalogue is photographed on white, so a
    // tinted page put every product in a faintly visible grey box, and the rails
    // and panels that hard-code `bg-white` stopped being flush with the page.
    // The tiles get their definition from spacing and their hover hairline
    // instead. The `--background` token in globals.css is the one place the
    // page's colour is decided, and this defers to it.
    <main className="pb-20">
      {/* ---- The hero, OUTSIDE the padded container below ----
           The page opens on a banner again, and the comment further down
           records that a hero banner was removed from exactly this position
           once before, so the difference is worth stating.

           What was removed was a hero banner PLUS a category card grid PLUS
           department chips PLUS coloured promo tiles — four blocks of
           navigation dressed as content, which together pushed the first real
           product below the fold on every phone. The objection was to the
           stack, not to the idea of a banner.

           This is one block, it makes a price promise rather than offering a
           fifth route into the departments, and it is built to stay short. If
           it ever grows a second panel beside it, that is the point at which
           this page is repeating its own history.

           ---- Why it is here and not inside the flex column ----

           It has to reach the full width of the content sheet, and the column
           below carries `md:px-8`. Rendering the hero inside it would inset the
           banner by 32px a side on desktop — visible as two off-white slivers
           down the edges of the artwork, which is exactly what a full-bleed
           hero must not have. Lifting it out is cleaner than cancelling the
           padding with a negative margin, which is the other way to do this and
           breaks the moment that padding changes.

           The consequence is that it sits outside the `gap-5 md:gap-8` that
           spaces every other section, so it has to carry that spacing itself —
           and the margin here is NOT that gap, because the container below
           already opens with `py-3 md:py-5`. 8 + 12 = the 20px phone gap, and
           12 + 20 = the 32px desktop one. Three numbers, one result; if any of
           them moves the hero drifts out of step with the rails beneath it. */}
      <div className="mb-2 md:mb-3">
        <HeroBanner settings={settings} />
      </div>
      {/* The page opens on merchandise.

          The hero banner and category card grid went first; the department
          chips and the coloured promo tiles have now followed them. All four
          were navigation dressed as content, and they pushed the first real
          product below the fold on every phone. The departments are one tap
          away in the header, which is where a shopper looks for them.

          ---- Spacing between sections ----

          20px on a phone, 32px from md up.

          This has been wrong in both directions and the history is worth
          keeping, because the fix is a RATIO and not a number. It was 36px,
          judged too loose and cut to 28 — but 28 was too tight, and the
          screenshots showed why: a rail's last line of product text sat closer
          to the *next* section's heading than that heading sat to its own
          products. The eye groups by proximity, so "Daily Deals" read as a
          caption belonging to the rail above it rather than a title for the row
          below, and the page arrived as one continuous stream of tiles with
          words occasionally in it. It went to 48px to fix that, and 48 fixed it.

          48 was also too much, in a way that is harder to see in a screenshot
          of one rail and obvious in a screenshot of five. A marketplace
          homepage is a dense shelf; the thing that signals a real one is that
          merchandise keeps arriving as you scroll. Half a rail's worth of empty
          white between every row is the signature of a page laid out to look
          designed rather than to sell — generous, even, uniform air, which is
          exactly the tell being asked about here. Amazon, AliExpress and Jumia
          all run their rails much closer than this.

          So the gap comes down to 32px, and the separation is preserved by
          bringing the *within*-section spacing down with it: a heading now sits
          12px above its own rail, not 14. 32 against 12 is a ratio of 2.7 — the
          same grouping the 48/14 pair bought, at two thirds of the height. Each
          block still reads as one object; there is simply less nothing between
          them.

          If a future change makes this feel crowded again, move BOTH numbers,
          not one. The moment the between-gap stops being roughly 2.5× the
          header gap, the page reverts to a stream of tiles. */}
      {/* Edge to edge on a phone, padded from md up.

          The side gutter used to be 12px, which bought nothing: it cost a
          product card most of its width on a 390px screen while the rails
          bled past it anyway with a 16px negative margin — 4px wider than the
          screen on each side, which is what made the whole page drift
          sideways. Removing the gutter fixes the drift and gives the width
          back to the products. Headings and copy carry their own `px-3` so
          words never touch the glass. */}
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-0 py-3 md:gap-8 md:px-8 md:py-5">
        {/* ---- Every carousel rail, desktop only ----
         *
         * On a phone this whole block is gone and the homepage is the hero
         * followed by one endless grid.
         *
         * The rails are a DESKTOP idiom. A horizontal carousel works when there
         * is a pointer to drag it, arrows to click and enough width to show six
         * tiles at once — then a rail is a curated shelf. On a 390px screen it
         * shows two and a half tiles, the rest is off-screen behind a swipe most
         * shoppers never make, and eight rails stacked means eight separate
         * swipes to see a fraction of the catalogue. What that actually
         * produces is a page where almost every product is hidden and the
         * shopper's whole job is scrolling past headings.
         *
         * A single endless grid is the phone answer, and it is what every large
         * marketplace serves on mobile: two columns, no interaction to learn,
         * every product on the vertical scroll the thumb is already doing.
         *
         * ---- What is lost, stated plainly ----
         *
         * The merchandising. Trending, New in, Daily Deals, Promotions, New
         * arrivals, Best sellers, the department rails and Super Deals do not
         * appear on a phone at all — and phones are most of this shop's
         * traffic. "Picked for you" is newest-first, so a shopper on a phone no
         * longer sees the deepest discount or the department landmarks unless
         * they go looking through the header.
         *
         * That is a real merchandising cost and it was asked for deliberately.
         * If it turns out to matter, the middle path is to keep ONE rail above
         * the grid — Daily Deals is the candidate, since price is what the
         * banner promises — rather than to bring all eight back.
         *
         * `hidden md:contents` rather than `hidden md:block`: `display: contents`
         * makes this wrapper vanish from the layout at md and up, so the
         * sections inside stay direct flex children of the column and keep the
         * `gap-5 md:gap-8` spacing exactly as before. A `block` wrapper would
         * collapse all eight rails into one flex item and destroy the spacing
         * between them. */}
        <div className="hidden md:contents">
        {trending.length > 0 && (
          <section id="trending" className="scroll-mt-32">
            <SectionHeader title="Trending now" href="/search?sort=popular" />
            {/* The first rail on the page, and so the one carrying the largest
                paint. Its leading tiles load eagerly; every rail below stays
                lazy. */}
            <DealCarousel products={trending} priority />
          </section>
        )}

        {/* ---- New in ----
             The newest listings from the shop's independent sellers, in the
             slot directly under Trending.

             Placed this high on purpose. A marketplace only works if sellers
             believe that listing here gets their goods in front of people, and
             the second rail on the front page is the most concrete form that
             promise can take: put something up, and it is on the homepage.
             Nobody has to merchandise it — the rail refreshes itself every time
             anyone lists anything.

             It is not the same as "New arrivals" further down, despite the
             similar name. That rail is the newest stock from any source, most
             of it the shop's own; this one is filtered on `product.seller`, so
             it is only ever marketplace listings. A shop trading with no
             sellers yet renders nothing here rather than an empty heading.

             "Sold by independent sellers on KandiUg" as the subtitle rather
             than something about freshness: the rail's real news to a shopper
             is that this shop is a marketplace with other people's shops in it,
             which is the thing that makes them come back to browse rather than
             to buy one item. */}
        {sellerArrivals.length >= MIN_RAIL && (
          <section aria-labelledby="new-in-heading">
            <SectionHeader
              id="new-in-heading"
              title="New in"
              subtitle="Just listed by sellers on KandiUg"
              href="/sellers"
              linkLabel="All stores"
            />
            <DealCarousel products={sellerArrivals} />
          </section>
        )}

        {/* ---- Daily Deals used to sit here, and does not any more ----

            It was a carousel of the day's biggest reductions on its own tinted,
            bordered band, directly under Trending.

            What it cost was more than the band: it was the third rail of
            products in a row, drawn differently from the two around it, saying
            the same thing the tiles already say. Every product on it carried
            its own −N% flag and its struck-through was-price, so the discount
            was never information the band was adding — it was a second, louder
            answer to a question the grid had already answered, and the tint and
            the border were the page shouting it.

            The feed still computes `dailyDeals` and `/api/app/home` still
            serialises it, so the app is untouched and nothing in
            `buildHomeFeed` had to be unpicked. The products themselves are not
            lost either: the ledger hands anything unclaimed to the endless grid
            further down, so they still appear — beside everything else, priced
            the same way, without a band around them.

            `components/home/DailyDeals.tsx` is left in place. Putting the
            section back is one import and one line. */}

        {/* What is on promotion, as the products themselves.

            This was a rail of coloured campaign cards — a badge, a headline and
            a "Shop now" arrow per card. Every one of them was a claim a shopper
            had to click through to test, on a page whose whole job is showing
            stock. The rail now carries the discounted products directly, in the
            same tiles as every other rail, so the offer is the price rather
            than a sentence about a price. */}
        {promoProducts.length >= MIN_RAIL && (
          <section aria-labelledby="promotions-heading">
            <SectionHeader
              id="promotions-heading"
              title="Promotions"
              subtitle="Running now across the shop"
              href="/sale"
              linkLabel="All offers"
            />
            <DealCarousel products={promoProducts} />
          </section>
        )}

        {/* A row of cards is a claim; these are the products a shopper can act
            on without leaving the page. */}
        {newArrivals.length >= MIN_RAIL && (
          <section aria-labelledby="new-arrivals-heading">
            <SectionHeader
              id="new-arrivals-heading"
              title="New arrivals"
              subtitle="The latest stock on the shop"
              href="/search?sort=newest"
            />
            <DealCarousel products={newArrivals} />
          </section>
        )}

        {bestSellers.length >= MIN_RAIL && (
          <section aria-labelledby="best-sellers-heading">
            <SectionHeader
              id="best-sellers-heading"
              title="Best sellers"
              subtitle="What shoppers here buy most"
              href="/search?sort=popular"
            />
            <DealCarousel products={bestSellers} />
          </section>
        )}

        {/* The three departments a shopper usually arrives already knowing they
            want. Placed after the discount and novelty rails deliberately:
            those answer "what is worth having today", which is what keeps
            somebody scrolling, and these answer "where do I go for my own
            things", which is what they scroll *to*. Any department the shop has
            not created simply does not appear. */}
        {departmentRails.map((department) => (
          <DepartmentRail
            key={department.id}
            id={department.id}
            title={department.title}
            subtitle={department.subtitle}
            chip={department.chip}
            href={department.slug ? `/category/${department.slug}` : "/categories"}
            products={department.products}
            /**
             * Two, not the four the curated rails ask for.
             *
             * A department is a promise about where things live rather than a
             * merchandising claim, so a thin one is a shop that is still
             * filling up — worth showing — where a two-item "Best sellers" rail
             * would be a claim the catalogue cannot support. This shop has two
             * men's products today; at a threshold of four the department a
             * shopper is most likely to be looking for would be invisible.
             */
            minimum={departmentMinimum}
          />
        ))}

        <SuperDeals products={deals} />
        </div>
        {/* ---- end of the desktop-only rails ---- */}

        {/* The wide orange offer slab used to sit here, between Super Deals and
            the endless grid. It carried the shop's terms — free delivery over a
            threshold, pay on delivery, the returns window — and those are worth
            saying, so they have not been lost: TrustBar below states pay on
            delivery and returns, and the masthead and footer both carry the
            free-delivery threshold from settings. None of them needs a
            full-width advertisement in the middle of the merchandise. */}

        <section>
          <SectionHeader title="Picked for you" />
          <InfiniteProducts
            initialProducts={latest}
            totalPages={latestTotalPages}
          />
        </section>

        {/* ---- What this visitor was last looking at ----
         *
         * At the FOOT of the page, after the endless grid has run out.
         *
         * It used to be second from the top, and the argument for that was
         * real: a shopper who leaves and comes back almost always came back for
         * something specific and already seen, so putting it in front of them
         * saves them finding it again. What that argument missed is that the
         * slot it was occupying is the most valuable one on the page, and this
         * rail is the only thing on the homepage that shows a returning shopper
         * nothing they have not already looked at. Spending the second screen
         * of a marketplace on stock somebody has demonstrably not bought yet is
         * backwards — the rails above sell, this one reminds.
         *
         * Down here it is doing the job it is actually good at. "Picked for
         * you" scrolls until the catalogue is exhausted, and the shopper who
         * reaches the end of it without buying is precisely the one worth
         * handing their own history back to. It is the last thing before the
         * trust strip rather than a detour on the way in.
         *
         * Unchanged: it renders nothing at all when the list is empty, so a
         * first-time visitor never sees an empty shelf, and it reads from
         * `kandi-recently-viewed-v1` in their own browser — the same place the
         * product page writes it — so it leaves the device no more than the
         * basket does. */}
        <RecentlyViewed className="" />

        <TrustBar returnsDays={settings.commerce.returns_days} />

        {/* Recruiting sellers at the foot of the page, after a shopper has seen
            what the shop looks like — the trader worth having is the one who
            liked the catalogue first. */}
        <SellWithUs settings={settings} storeCount={storeCount} />

        {/* ---- About the shop, at the foot of the page ----
         *
         * The homepage `<h1>` lives here rather than above the first rail.
         *
         * It still does its whole SEO job from the bottom of the document: an
         * `<h1>` is read by position in the outline, not by position on the
         * screen, and this is the page that ranks for the shop's own name and
         * for "online shopping Uganda". What moving it down buys is that the
         * page opens on merchandise, which is what the layout above was built
         * for in the first place.
         *
         * The prose underneath is not filler. A homepage that is otherwise
         * nothing but product tiles gives a crawler almost no text to read, and
         * this is where the shop says in plain sentences what it sells, where
         * it delivers and how payment works — the phrases people actually type
         * into Google. Every figure in it comes from the shop's own settings,
         * so it cannot drift away from what the checkout does.
         */}
        {/* Left-aligned and full width, rather than centred in a 68ch column.
            This is the treatment the large marketplaces give their closing
            copy: it is reference text at the bottom of a long page, not a
            statement — centring it and setting it at 15px made it look like a
            mission statement demanding to be read, which is exactly what a
            shopper who has scrolled this far will not do. Dense, ranged left
            and a step smaller, it reads as the footnote it is, and the crawler
            gets the same words either way. */}
        <section
          aria-labelledby="about-kandi"
          // No `mt-4` any more. The flex `gap` above already puts 20–32px in
          // front of this block, and the extra margin stacked on top of it —
          // making the one boundary that already has a rule drawn across it
          // also the widest gap on the page. The rule is the separation; it
          // does not need to be underlined with air as well. `pt-6` rather than
          // `pt-8` for the same reason.
          className="border-t border-shop-line px-4 pt-6 md:px-8"
        >
          <h1
            id="about-kandi"
            className="text-[15px] leading-snug text-shop-body md:text-[16px]"
          >
            {/* The registered name and the name people type, in the one
                element Google weighs most heavily on the page.

                "KandiUg" is not decoration and it is not keyword stuffing: it
                is the shop's own address, the name on its receipts and the
                phrase every returning customer searches. Saying it once, in
                the `<h1>`, is the difference between Google knowing this site
                is the answer to "kandi ug" and Google having only a JSON-LD
                alias to go on. Set lighter than the registered name so the
                brand still reads as one wordmark rather than two. */}
            {/* "Kandi For Less | KandiUg" on one line, the way the reference
                heads its own closing block with the store's two names. Both are
                this shop: one is registered, the other is what people type. */}
            <span className="block text-[17px] font-bold text-shop-ink md:text-[18px]">
              {brandName(settings)}
              <span className="mx-1.5 font-normal text-shop-faint">|</span>
              KandiUg
            </span>
            <span className="mt-1 block">
              {"Online shopping in Uganda. "}
              <span className="font-semibold text-shop-ink">
                Fast delivery, pay on delivery
              </span>
              {` and ${settings.commerce.returns_days}-day returns.`}
            </span>
          </h1>

          <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-shop-body">
            <p>
              {brand} — also known as <strong className="font-semibold text-shop-ink">KandiUg</strong>,
              after the kandiug.com address — is a Ugandan online marketplace
              selling shoes, clothing, electronics, home essentials and more —
              from our own shelves and from independent Ugandan stores approved
              to sell alongside us.
              Every listing is checked before it goes live, and every seller is
              vetted individually, so a low price here is a real one rather than
              a risk.
            </p>
            <p>
              We deliver countrywide. Orders around Kampala usually arrive within
              one to two working days and upcountry within five, with{" "}
              <span className="font-semibold text-shop-ink">
                free delivery on orders over {formatPrice(settings.commerce.free_delivery_from)}
              </span>
              . Pay however suits you: cash to the courier on delivery, MTN Mobile
              Money, Airtel Money, or by card at checkout.
            </p>
            <p>
              Changed your mind? You have{" "}
              <span className="font-semibold text-shop-ink">
                {settings.commerce.returns_days} days
              </span>{" "}
              from delivery to send an item back, and if it arrives faulty or
              wrong we cover the courier both ways.{" "}
              <Link href="/about" className="font-semibold text-shop-primary hover:underline">
                More about us
              </Link>
              {" · "}
              <Link href="/shipping" className="font-semibold text-shop-primary hover:underline">
                Delivery
              </Link>
              {" · "}
              <Link href="/returns" className="font-semibold text-shop-primary hover:underline">
                Returns
              </Link>
              {" · "}
              <Link href="/help" className="font-semibold text-shop-primary hover:underline">
                Help centre
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
