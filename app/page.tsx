import { buildHomeFeed, MIN_RAIL } from "@/lib/home-feed";
import DepartmentRail from "@/components/home/DepartmentRail";
import DealCarousel from "@/components/DealCarousel";
import HeroBanner from "@/components/home/HeroBanner";
import MaximiseSavings from "@/components/home/MaximiseSavings";
import TrustRibbon from "@/components/home/TrustRibbon";
import ShopByCategory from "@/components/home/ShopByCategory";

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
    departments,
    categoryImages,
    trending,
    sellerArrivals,
    promoProducts,
    deals,
    newArrivals,
    bestSellers,
    departmentRails,
    latest,
    latestTotalPages,
    departmentMinimum,
    proof,
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
    /* ---- The page is a canvas now, and the sections stand on it ----

       This was `bg-white`, under a long note arguing that white is the right
       page colour because most of this catalogue is photographed on white and a
       tint puts every product in a faintly visible grey box. That note is kept
       in globals.css because it is still true — and it was answering the wrong
       question. Both of the colours it kept choosing between were flat pages
       with sections running edge to edge down them, and a flat page of any
       colour gives the eye nothing to group by: the homepage arrived as one
       continuous stream of tiles with occasional words in it.

       So the colour moves off the page and onto the SECTIONS. Every block below
       is a white `.shop-panel`, the canvas shows in the gutter and in the gaps
       between them, and no product photograph ever touches the tint — which is
       the exact objection the white argument was built on, answered by
       structure rather than by picking the other colour.

       `bg-shop-canvas` rather than `--background`, so this is the homepage's
       ground and not the shop's. See the token's own note for why the other
       twelve page types must not inherit it. */
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
           that {@link TrustRibbon} and the first deal panel do not.

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
      {/* ---- The band is now evidence as well as terms, and it shows on a
           phone ----

           `PromiseBand` stood here and is deleted. It was three promises on
           pale green, hidden below `md`, and both of those turned out to be
           wrong for the page as it now stands — the full reasoning is at the
           head of {@link TrustRibbon}, but the short version is worth having
           here because this slot has a history of being argued about.

           On a phone the page had NOTHING above the merchandise: no hero
           unless the shop has uploaded artwork, no rails, no department row.
           The band was hidden back when it was the fourth strip competing for
           the opening screen, and it has been outlived by every one of the
           other three. So the shop's majority device was reading a bare grid of
           tiles with no statement anywhere on it about delivery, payment or
           returns — those words survive only in the footer, past an endless
           grid nobody reaches.

           And it carries live figures now: a star rating with the review count
           behind it, a floor on units delivered, the number of vetted stores.
           That is the half the old band could not do. Terms are the shop
           talking about itself; a review count is a shopper being asked to
           check. Every figure is computed from data the feed already fetched
           and every one is deliberately smaller than the truth — see
           `HomeProof` in lib/home-feed.ts.

           The height budget is held to the test this slot has always been
           given, and measured rather than asserted. From `sm` up it is 36px —
           the same single line the old band cost, because the two promises the
           announcement strip already carries hide themselves at exactly the
           widths that strip shows them. On a phone it wraps to two rows and 59px,
           which is what a device that had no band at all now pays for the whole
           statement. No artwork, no offer, nothing clipped at 360px. */}
      <TrustRibbon
        freeDeliveryFrom={settings.commerce.free_delivery_from}
        returnsDays={settings.commerce.returns_days}
        proof={proof}
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

          So the gap came down to 32px, and the separation was preserved by
          bringing the *within*-section spacing down with it: a heading sat
          12px above its own rail, not 14. 32 against 12 is a ratio of 2.7 —
          the same grouping the 48/14 pair bought, at two thirds of the
          height.

          ---- And down again: 24 against 10 ----

          Asked for after the page had grown coloured bands. That matters,
          because a tinted shelf separates ITSELF: the Super Deals ground and
          the savings shelf both draw their own edge, so the white gap either
          side of them is doing a job the colour has already done. Air
          between two white rails is the only place it is still load-bearing,
          and 24px is enough there.

          BOTH numbers moved, which is the rule this note has carried since
          the 48px pass and the reason it is worth reading before touching
          either: `SectionHeader` went from `mb-3` to `mb-2.5`, so 24 against
          10 is a ratio of 2.4 — the same grouping again, at three quarters
          of the height. Each block still reads as one object.

          The phone step went 20 to 16 and its ratio is unchanged at about
          1.6, which it has always been: a phone has no room for desktop
          proportions, and the rails are gone below `md` anyway.

          If this ever feels crowded, move BOTH again. The moment the
          between-gap stops being roughly 2.5x the header gap, the page
          reverts to a stream of tiles. */}
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
      {/* ---- The banner is full bleed, and so it lives outside the column ----

           It was the first child of the padded column, which capped it at the
           shell and inset it by the column's own gutter — 12px on a phone,
           32px from md. That was deliberate at the time: the note in
           `HeroBanner` argued the banner and the product grid should share two
           edges so the artwork reads as part of the page rather than as a
           picture floating over it.

           The shop wants the full width, and on a canvas-and-panels page that
           is the better arrangement anyway. Every section below is a bounded
           object with margin around it; the banner running edge to edge is what
           makes it read as the page's opening image rather than as the first
           panel in the stack. It is the one block on the homepage that is
           artwork rather than merchandise, and it is now the only one that is
           not inset.

           It has to be a sibling of the column rather than a child of it, since
           a child cannot escape `max-w-[var(--shell)]` without a negative
           margin matched to a padding that changes at a breakpoint — the exact
           arrangement the panel system was introduced to delete.

           `priority` still holds and matters more here: this is the first thing
           in `<main>` now, so it is unambiguously the Largest Contentful Paint.

           `imageOnly` also still holds. No upload, no banner, no fallback text
           hero — see the prop's own note. */}
      <HeroBanner settings={settings} imageOnly />

      <div className="mx-auto flex max-w-[var(--shell)] flex-col gap-4 px-3 py-3 md:gap-6 md:px-8 md:py-5">
        {/* ---- The campaign banner opens the page ----

             It was under the deal panels; it is the first thing in the column
             now, and the deal panels are gone entirely.

             ---- What went, and why it is not a loss ----

             `TwinDeals` (now deleted) drew Lightning and Clearance side by
             side. It had been
             rebuilt three times in short order — carousels taken out for grids,
             grids capped to one row, the whole section hidden below `md` — and
             each of those repairs was narrowing what it was allowed to do. That
             is usually the signal that a block is being kept for its history
             rather than its job.

             Its job is done better elsewhere and always was. `SuperDeals`
             further down is the deepest-cut strip in the shop and now has a
             yellow shelf of its own; /sale is the page a shopper looking for a
             discount actually goes to, and it is linked from the masthead on
             every page. Two headings, two countdowns and eight tiles of
             markdown on the opening screen was the third telling of the same
             story, before the shopper had seen a single ordinary product.

             ---- Why the banner takes the slot ----

             A campaign band is what the top of a marketplace homepage is for,
             and this one is empty until the shop uploads artwork — so on a shop
             with no campaign running, the page now opens directly on
             merchandise, which is exactly what the hero note above spent six
             paragraphs arguing for. The slot costs nothing when unused, which
             the deal panels never could.

             `priority` is back on, and it has to be: this is the first element
             in the column now, so it IS the Largest Contentful Paint when it
             renders at all. It was `false` while the banner sat below the fold,
             where a high-priority preload would have competed with the product
             rails. Position changed, so the flag changed with it.

             `imageOnly` still holds. No upload, no banner, no fallback text
             hero — see the prop's own note. */}

        {/* ---- The department shortcut row is back, and this time it has a job ----

             It has been chips, then circles, then a card grid, and all three
             were deleted with the same verdict: nobody could say what the row
             was for that the masthead was not already doing. That verdict was
             right every time it was made.

             It stopped being right when the department bar came out of the
             masthead below `md`. A phone now reaches the catalogue's structure
             through the hamburger and nothing else, so this row is not a second
             route to the departments any more — on the shop's majority device
             it is the only one. The full argument is at the head of
             {@link ShopByCategory}.

             Above the merchandise, against this page's own rule, and the rule
             survives it: what the rule forbids is FOUR blocks of navigation
             stacked into the opening screen, which is what it was written for.
             This is one block, and it is the block that decides whether a
             shopper who arrived wanting shoes finds out this shop sells them. */}
        <ShopByCategory departments={departments} categoryImages={categoryImages} />

        {/* ---- Three blocks reach a phone. The other six still do not ----
         *
         * The rule used to be simpler and it was too simple: EVERY rail sat
         * inside `hidden md:contents`, so a phone got the banner and one
         * endless grid and nothing else. The reasoning behind that is still
         * mostly right and is kept below, because the middle path taken here is
         * the one it named.
         *
         * The rails are a DESKTOP idiom. A horizontal carousel works when there
         * is a pointer to drag it, arrows to click and enough width to show six
         * tiles at once — then a rail is a curated shelf. On a 390px screen it
         * shows two and a half tiles, the rest is off-screen behind a swipe most
         * shoppers never make, and NINE rails stacked means nine separate swipes
         * to see a fraction of the catalogue. What that produces is a page where
         * almost every product is hidden and the shopper's whole job is
         * scrolling past headings. A single endless grid is the phone answer,
         * and it is what every large marketplace serves on mobile.
         *
         * ---- What "all of them or none of them" cost ----
         *
         * Stated plainly at the time, and it turned out to be the expensive
         * half: phones are most of this shop's traffic, and "Picked for you" is
         * newest-first, so the shopper on a phone never saw the deepest
         * discount, never saw who they were buying from, and had the whole
         * marketplace presented to them as an undifferentiated stream of
         * newest-first stock. Nine rails on a phone is a page nobody can use;
         * nought rails is a shop with no shopfront. The note itself proposed
         * the answer — "the middle path is to keep ONE rail above the grid" —
         * and this is that, with the count argued rather than assumed.
         *
         * ---- The three that earn a phone screen ----
         *
         *   • Trending now. One rail of what is actually moving. It is the
         *     cheapest possible answer to "is anything here worth having", and
         *     it is the rail the note above nominated in spirit.
         *   • Super Deals. Price is the reason most of this shop's traffic
         *     arrives, and it is the one thing the endless grid cannot say —
         *     the grid is newest-first, so the deepest cut in the catalogue can
         *     sit forty screens down it. One ink shelf puts it on screen two.
         *   • Shop by store. Not a rail at all: a two-column GRID of vetted
         *     sellers, so it costs no swipe. It is also the only block on the
         *     phone page that says this is a marketplace of real Ugandan shops
         *     rather than one anonymous warehouse, which is the thing a
         *     first-time buyer is actually deciding about.
         *
         * Everything else stays desktop-only, and the reason is that each one
         * is the same catalogue in another order: New in, Promotions, New
         * arrivals and Best sellers are all cuts of stock the endless grid
         * below already carries, so on a phone they buy four extra swipes and
         * no new information. The department rails are the closest call — they
         * answer "where do I go for my own things" — but the departments are
         * one tap away in the masthead on every screen, and four more rails is
         * exactly the stack this note exists to prevent.
         *
         * The phone page is therefore: banner, ribbon, one rail, one deals
         * shelf, the sellers, then the endless grid. Two swipes, not nine.
         *
         * `hidden md:contents` rather than `hidden md:block`: `display: contents`
         * makes this wrapper vanish from the layout at md and up, so the
         * sections inside stay direct flex children of the column and keep the
         * `gap-4 md:gap-6` spacing exactly as before. A `block` wrapper would
         * collapse the rails into one flex item and destroy the spacing between
         * them. */}
        {trending.length > 0 && (
          /* Accent-tinted, with Super Deals directly below it. These are the
             two shelves that sell — what is moving, and what is cheapest — and
             with the page and its panels sharing one off-white they had nothing
             marking them out from the nine shelves that merely list. See
             the accent-shelf note in globals.css for why it is two sections,
             why they take different colours, and why it must stay
             two. */
          <section id="trending" className="shop-panel shop-panel-trending scroll-mt-32">
            <SectionHeader title="Trending now" href="/search?sort=popular" />
            {/* The first rail on the page, and so the one carrying the largest
                paint. Its leading tiles load eagerly; every rail below stays
                lazy. */}
            <DealCarousel products={trending} priority />
          </section>
        )}

        {/* Moved up from the foot of the rails, where it was the eighth of nine
            sections and — below `md` — was not drawn at all.

            Position two on both screens now. On a desktop that is a change of
            emphasis rather than of kind: the ink shelf was the loudest thing on
            the lower half of the page and is now the loudest thing near the top
            of it, which is where the shop's sharpest prices belong on a page
            competing with marketplaces that lead on price. On a phone it is the
            difference between the deepest cut in the catalogue being on screen
            two and being invisible.

            It draws nothing when nothing is on sale, so a shop running no
            discounts gets Trending followed straight by the sellers rather than
            an empty shelf where the deals should be. */}
        <SuperDeals products={deals} />

        {/* ---- Best sellers takes this slot, and Shop by store is gone ----

             The seller row stood here — eight vetted storefronts, on the
             argument that Kandi is a marketplace and the homepage never said
             so. That argument was sound and it is not what the slot is worth.
             This is the third screen of the page on every device, directly
             under the deals shelf, and it was spending that position on
             NAVIGATION: eight links to eight listing pages, none of them
             showing a price, a photograph or anything a shopper can buy.

             What goes here instead is the one rail with a claim behind it that
             no other rail on the page can make. Trending is the shop's own
             picks; New in and New arrivals are sorted by date; Promotions and
             Super Deals are sorted by discount. Best sellers is the only shelf
             ordered by what other people actually bought — and `buildHomeFeed`
             will not fill it from products with no sales at all, so the claim
             is enforced rather than decorative. On a page whose job is
             persuading a first-time buyer, "these are the ones that sell" is
             the strongest sentence available, and it was buried at position
             seven behind four rails of the same catalogue in other orders.

             It also moves the rail onto phones, which is the larger half of the
             change: it was inside the desktop-only block, so the shop's
             majority device never saw it.

             The marketplace fact the seller row carried is not lost. "New in"
             is filtered on `product.seller` and subtitled "From independent
             Ugandan stores, not our own shelves"; the closing copy names the
             marketplace in the page's `<h1>`; the masthead carries "Shop by
             store" on every page of the shop; and /sellers is still the
             directory it always was. What is gone is a row of shopfronts in
             the middle of the merchandise.

             `components/home/ShopByStore.tsx` is DELETED rather than left
             sitting unrendered. This page was its only importer — /sellers
             builds its own directory and never used it — so leaving the file
             behind would have left a component nobody knows is dead, which is
             the rule this codebase applies to every block it has removed. It
             is in the history if the row is ever wanted back.

             `stores` came out of this page's destructure with it, and
             `buildHomeFeed` still computes both `stores` and `storeCount`:
             `/api/app/home` serialises the count for the phone app, which is a
             separate reader with its own reasons. */}
        {bestSellers.length >= MIN_RAIL && (
          <section aria-labelledby="best-sellers-heading" className="shop-panel">
            <SectionHeader
              id="best-sellers-heading"
              title="Best sellers"
              subtitle="The ones other shoppers keep buying"
              href="/search?sort=popular"
              linkLabel="All best sellers"
            />
            <DealCarousel products={bestSellers} />
          </section>
        )}

        <div className="hidden md:contents">

        {/* ---- The savings shelf, after the shopfront and before the rails ----

             A cream band of offers — a code, a headline, the qualifying line —
             in the first slot of the desktop-only block. It used to sit
             immediately below Trending; Super Deals and the seller grid now
             stand between, which does not weaken the argument for the position
             and arguably strengthens it.

             The argument was always about what the shopper has just done, not
             about which rail is above: somebody who has scrolled a rail of
             products has shown they are shopping, and "here is how to pay less
             for these" is the right next sentence. Put it above the first rail
             and it is a coupon page nobody asked for; put it four rails down
             and it is never read. A reader who has now passed Trending, the
             deals shelf AND the sellers has shown it three times over, and this
             is still the third screen rather than the tenth.

             It renders `settings.promotions`, which has carried exactly this
             shape — badge, headline, note, url — for a long time with NO
             consumer anywhere in the shop. It was declared, parsed, defaulted to
             an empty array and read by nothing. So this is not a new field to
             fill in; it is the screen that finally renders one that existed.

             Empty is the shipped state and the section draws nothing for it,
             which is what makes it safe to put this high on the page. A
             "Maximise your savings" band holding two placeholder offers is
             worse than no band at all.

             It sits INSIDE the desktop-only `md:contents` wrapper with the
             rails, and that is deliberate rather than incidental: the phone page
             is a grid of products and nothing else, and a band of offers with
             conditions attached is exactly the kind of thing the note above
             stripped out of it. */}
        <MaximiseSavings settings={settings} />

        {/* ---- New in ----
             The newest listings from the shop's independent sellers, in the
             first product rail of the desktop-only block.

             Placed this high on purpose. A marketplace only works if sellers
             believe that listing here gets their goods in front of people, and
             a rail near the top of the front page is the most concrete form
             that promise can take: put something up, and it is on the homepage.
             Nobody has to merchandise it — the rail refreshes itself every time
             anyone lists anything.

             It reads as one rail lower than it used to, and it is not: Shop by
             store now sits above it, which names the same sellers by their own
             shopfronts. A trader arriving to see whether listing here means
             anything meets their storefront first and their newest stock
             immediately after, which is a stronger answer than the rail gave on
             its own.

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
          <section aria-labelledby="new-in-heading" className="shop-panel">
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
          <section aria-labelledby="promotions-heading" className="shop-panel">
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
          <section aria-labelledby="new-arrivals-heading" className="shop-panel">
            <SectionHeader
              id="new-arrivals-heading"
              title="New arrivals"
              href="/search?sort=newest"
            />
            <DealCarousel products={newArrivals} />
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
            band={department.band}
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

        </div>
        {/* ---- end of the desktop-only rails ----

             Super Deals and Shop by store used to close this block; they are
             now above it, outside the wrapper, so a phone gets them. The
             department rails are the last thing a desktop reader meets before
             the endless grid, which is the right handover: they answer "where
             do I go for my own things", and "Picked for you" directly below is
             where that browse actually happens. */}

        {/* The wide orange offer slab used to sit here, between Super Deals and
            the endless grid. It carried the shop's terms — free delivery over a
            threshold, pay on delivery, the returns window — and those are worth
            saying, so they have not been lost: TrustBar below states pay on
            delivery and returns, and the masthead and footer both carry the
            free-delivery threshold from settings. None of them needs a
            full-width advertisement in the middle of the merchandise. */}

        <section className="shop-panel">
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
          /* A panel, where this was a rule drawn across a white page. The
             rule was the only thing separating the closing copy from the
             merchandise above it; the canvas does that now, and a hairline on
             top of a panel edge is the same boundary stated twice. */
          className="shop-panel"
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
