import { buildHomeFeed, MIN_RAIL } from "@/lib/home-feed";
import DepartmentRail from "@/components/home/DepartmentRail";
import DealCarousel from "@/components/DealCarousel";
import HeroBanner from "@/components/home/HeroBanner";
import PromiseBand from "@/components/home/PromiseBand";
import TwinDeals from "@/components/home/TwinDeals";
import SuperDeals from "@/components/home/SuperDeals";
import SectionHeader from "@/components/home/SectionHeader";
import InfiniteProducts from "@/components/home/InfiniteProducts";
import RecentlyViewed from "@/components/RecentlyViewed";
import TrustBar from "@/components/home/TrustBar";
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
 * ---- One separator ----
 *
 * This read "KandiUg — Online Shopping in Uganda | {brand}", with an em dash
 * and a pipe in the same string. A browser tab clips a title to roughly 25
 * characters, so what a shopper actually saw beside the favicon was "KandiUg —
 * Onl…": the brand, then a dash hanging off it. Nothing separates the query
 * from the phrase now — "KandiUg Online Shopping in Uganda" reads as one thing
 * because it IS one thing — and the pipe stays where it is earning its keep,
 * between the searched name and the registered one.
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
      absolute: `KandiUg Online Shopping in Uganda | ${brand}`,
    },
    description:
      `KandiUg (${brand}) is a Ugandan online marketplace for shoes, fashion, ` +
      `electronics and home. Fast delivery countrywide, pay on delivery, ` +
      `${settings.commerce.returns_days}-day returns.`,
    openGraph: {
      type: "website",
      title: `KandiUg Online Shopping in Uganda`,
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
    dailyDeals,
    newArrivals,
    bestSellers,
    departmentRails,
    latest,
    latestTotalPages,
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
      {/* ---- The hero is gone, and this is the third time ----

           A hero banner has now been removed from this slot twice and added
           back once, so the history is the useful part of this note.

           The first removal took a hero PLUS a category card grid PLUS
           department chips PLUS coloured promo tiles — four blocks of
           navigation dressed as content, which together pushed the first real
           product below the fold on every phone. It came back as one block that
           made a price promise rather than offering a fifth route into the
           departments, with a warning attached: "if it ever grows a second
           panel beside it, that is the point at which this page is repeating
           its own history."

           It never grew that panel. What it did instead was cost roughly a
           third of a phone screen to say something the masthead strip, the band
           below and the footer all already say — and it said it in artwork,
           which is the most expensive way for a page to say anything. The shop
           asked for the space back, and it is right: on a marketplace homepage
           the opening screen is worth more filled with priced goods than with a
           picture of goods.

           So this slot now carries a 36px band of terms instead of a banner,
           and the merchandise starts immediately under it. If a hero is ever
           proposed again, the question to answer first is what it would say
           that {@link PromiseBand} and the first deal panel do not.

           ---- Why the band is here and not inside the flex column ----

           Unchanged from the hero's reasoning: it has to reach the full width
           of the content sheet, and the column below carries `md:px-8`, which
           would inset it by 32px a side and leave the coloured band floating
           with two white slivers down its edges. Lifting it out is cleaner than
           cancelling the padding with a negative margin, which breaks the
           moment that padding changes.

           It needs no margin of its own, where the hero needed `mb-2 md:mb-3`
           carefully tuned against the column's `py-3 md:py-5`. A full-bleed
           band with a border under it wants to sit flush against the chrome
           above and let the column's own top padding open the page beneath —
           three numbers become none, which is one fewer thing to keep in
           step. */}
      {/* No phone gutter here, unlike every other block on the page.

          This carried `px-3` so the banner stopped where the grid below it
          stopped, on the reasoning that a full-bleed hero over an inset grid
          reads as a mistake. On a real handset it is the other way round: the
          banner is a photograph, not a card, and 12px of page showing down
          each side of it looks like a card that failed to fill its slot. Full
          bleed is what a hero is for, and the inset grid beneath it then reads
          as the content the hero frames.

          From md up the container's own `md:px-8` would inset this, which is
          why the hero sits outside that container — see the note above. */}
      <PromiseBand
        freeDeliveryFrom={settings.commerce.free_delivery_from}
        returnsDays={settings.commerce.returns_days}
      />
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
      {/* ---- A 12px gutter on a phone, 32px from md up ----

          The gutter was removed once and the reason it was removed is worth
          keeping: it cost a product card most of its width on a 390px screen
          while the rails bled past it anyway with a 16px negative margin — 4px
          wider than the screen on each side, which is what made the whole page
          drift sideways.

          The bleeding rails are gone (there is not a negative margin left in
          the codebase), so the gutter costs only what it says it costs, and it
          now has a job it did not have then: the tiles are white cards on an
          off-white ground, and a card running into the glass reads as a card
          that was cut off. 12px is a thumb's width of page showing down each
          edge — enough for the cards to sit ON the page rather than in a hole
          punched through it.

          Headings and copy inside no longer carry their own `px-3`: this is
          their gutter now, and doubling it would have set every section title
          24px in from a grid that starts at 12. */}
      <div className="mx-auto flex max-w-[var(--shell)] flex-col gap-5 px-3 py-3 md:gap-8 md:px-8 md:py-5">
        {/* ---- The page opens on priced goods, at every width ----

             Two deal panels, and they are the first thing under the chrome
             because the hero that used to be here is gone. Sixteen products are
             in this block where previously there was a photograph and, below the
             fold, an undifferentiated grid.

             ---- This is OUTSIDE the desktop-only block below, and it is now a
             scroller, so the reason has changed ----

             Every other rail on this page is hidden on a phone, for the reason
             set out at length under this comment: a horizontal carousel needs a
             pointer, arrows and the width for six tiles, and on a 390px screen
             it is two and a half tiles with the rest behind a swipe nobody
             makes. That used to be a clean line, because {@link TwinDeals} was a
             grid and had none of the properties the rails are hidden for. It is
             two carousels now, so it no longer sits on the safe side of that
             line by construction.

             It stays out here anyway, because the argument against phone rails
             is about EIGHT of them: eight swipes to see a fraction of the
             catalogue, with the shopper's whole job being scrolling past
             headings. That block's own note names the middle path — "keep ONE
             rail above the grid — Daily Deals is the candidate, since price is
             what the banner promises". This is that rail, split in two so the
             timed offer and the permanent markdown stay distinguishable, and it
             is the only swipe on the phone page. */}
        <TwinDeals products={dailyDeals} />

        {/* ---- The promo banner, under the deals ----

             A full-width strip in the slot directly after Lightning and
             Clearance — the position the reference storefronts put a campaign
             band in, and the right one: the shopper has just been shown the two
             price stories, and a banner here is the third thing the shop wants
             to say rather than an interruption before the first.

             It is `HeroBanner` rather than anything new. That component already
             does every hard part of this — an art-directed pair of crops so a
             2.4:1 banner is not letterboxed on a phone, a hand-built srcset,
             and `image_alt` carrying what the artwork SAYS, since words baked
             into a picture are invisible to Google and to a screen reader. It
             was written for the hero slot at the top of the page, and that slot
             no longer exists (see the note above), so it has been sitting in
             the tree rendering nowhere.

             Two props keep it honest down here:

             `imageOnly` — no upload, no banner. Without it the component falls
             back to its built-in TEXT hero, which is correct at the top of a
             page and absurd wedged between two rails of merchandise.

             `priority={false}` — the preload pair inside it is `fetchPriority:
             high`, which is right for the first screen and harmful below it: it
             would make a promo strip compete with the real Largest Contentful
             Paint, the first row of product photographs. The goods outrank the
             advertisement.

             The artwork itself is uploaded in wp-admin under "Kandi Storefront"
             — image, optional phone crop, link and alt text. Nothing is
             hard-coded here, so a campaign can start and end without a
             deploy. */}
        <HeroBanner settings={settings} imageOnly priority={false} />

        {/* ---- The department shortcut row is gone from the homepage ----

             It was chips, then circles, and now nothing. Worth recording all
             three, because the reason it kept being rebuilt is the reason it
             is now removed: nobody could say what it was for that the
             masthead was not already doing.

             Every department on it is in the Categories mega-menu, which is
             on this page and every other page of the shop, and the menu shows
             the CHILDREN too — so the row was the shallower of two routes to
             the same place, sitting in the middle of the merchandise. The
             argument that kept it here was that a phone shopper reaches
             departments only through the masthead; that is true and the
             masthead is one tap away, which is the same distance the row was.

             What it cost was a band across the page between the deals and the
             rails. On a homepage whose whole layout argument is that
             navigation goes BELOW merchandise rather than above it, a strip of
             navigation wedged between two blocks of merchandise was the one
             thing on the page not obeying it.

             `CategoryCircles` is deleted rather than left unrendered, and
             `departments` came out of this page's destructure with it — the row
             was its last reader here. The tree is still built and still served:
             the header takes it for the mega-menu from the layout, and
             `departmentRails` is a separate, already-composed field. */}

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
              subtitle="From independent Ugandan stores, not our own shelves"
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
              href="/search?sort=popular"
            />
            <DealCarousel products={bestSellers} />
          </section>
        )}

        {/* The three departments a shopper usually arrives already knowing they
            want. Placed after the discount and novelty rails deliberately:
            those answer "what is worth having today", which is what keeps
            somebody scrolling, and these answer "where do I go for my own
            things", which is what they scroll *to*.

            A department the shop has not created does not appear here, and
            neither does one with fewer than twenty products in it — a rail is
            an invitation to browse a section, and a section a shopper can
            exhaust in one screen is not worth being sent to. The threshold is
            `DEPARTMENT_CATALOGUE_MINIMUM` in lib/home-feed.ts. */}
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
             * Two, not the four the curated rails ask for — and by the time a
             * rail gets here, this number has almost nothing left to decide.
             *
             * The real gate is upstream: `buildHomeFeed` now drops any
             * department whose CATALOGUE holds fewer than twenty products, so a
             * rail that reaches this map is one the shop genuinely has a
             * section for. See `DEPARTMENT_CATALOGUE_MINIMUM` in
             * lib/home-feed.ts for why the count is taken against the
             * department's total rather than against the row.
             *
             * This one is the row-length guard behind it: a department is a
             * promise about where things live rather than a merchandising
             * claim, so a thin ROW is a department the ledger happened to strip
             * rather than a claim the catalogue cannot support. Two is enough
             * to say "this way", where a two-item "Best sellers" rail would be
             * a claim about the stock itself.
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

        {/* ---- The seller recruitment panel is gone from here ----

            It sat between the trust strip and the about block: an orange
            eyebrow, a display headline, three terms of the deal and two
            buttons, in a bordered panel the width of the page.

            The argument for it was that the trader worth having is the one who
            liked the catalogue first, so ask at the foot rather than on the way
            in. That is still true, and it is still asked — "Sell on Kandi" is
            in the department bar on every page of the shop, and it goes to
            /sell, which is a page built to make this case at length and does it
            far better than a panel can.

            What the panel actually did here was end the shopping page on a
            recruitment pitch. The reader who reaches the bottom of the
            homepage is a shopper who has not bought anything yet, and the last
            full screen they were given talked about commission rates and
            payout schedules. `RecentlyViewed` directly above it is the right
            answer to that reader — their own trail, handed back — and the
            panel was stepping on it.

            The component was deleted with it — `components/home/SellWithUs`
            is gone rather than left sitting unrendered, since a component
            nothing imports is a component nobody knows is dead. It is in the
            history if the panel is ever wanted back.

            `storeCount` came out of this page's destructure at the same time,
            but `buildHomeFeed` still computes it: `/api/app/home` serves it to
            the phone app, which is a separate reader with its own reasons. */}

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
