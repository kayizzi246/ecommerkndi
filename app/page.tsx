import { buildHomeFeed } from "@/lib/home-feed";
import ChannelRow from "@/components/home/ChannelRow";
import PortalBand from "@/components/home/PortalBand";
import PickedForYou, { type PickedTab } from "@/components/home/PickedForYou";
import RecentlyViewed from "@/components/RecentlyViewed";
import { brandName, getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";
import { itemListJsonLd, productPath } from "@/lib/seo";
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

/**
 * The homepage, rebuilt as a portal.
 *
 * ---- What changed, in one paragraph ----
 *
 * This page was a STACK. Banner, then Trending, then Super Deals, then Best
 * sellers, then Maximise your savings, then New in, then Promotions, then New
 * arrivals, then up to five department rails, then the endless grid: nine
 * headings and about six screens of scrolling before a shopper reached anything
 * they had not been walked past. Below `md` most of it was hidden outright,
 * which meant the shop's majority device got a banner and one grid, and the
 * argument for hiding it — nine carousels on a 390px screen is nine swipes to
 * see a fraction of the catalogue — was correct. That is the shape of a page
 * that has run out of room: every block defensible, the whole indefensible.
 *
 * It is a HERO and a BAND now, in the arrangement the large marketplaces have
 * settled on. A full-width campaign opens the page, then three columns — where
 * things are, what it costs, and who the shopper is — then the endless grid with the departments as tabs across it. The same
 * merchandise, the same feed, the same `lib/home-feed.ts` composing it; what is
 * gone is the scrolling between the parts.
 *
 * ---- Where each of the old sections went ----
 *
 *   Hero banner        → removed. The page opens on the channel strip.
 *   Super Deals        → the price panel in the band. Six products, six
 *                        prices, the same countdown.
 *   Trending now       → leads the "For you" grid, which is what "picked for
 *                        you" ought to have meant all along.
 *   Best sellers, New in, Promotions, New arrivals, Maximise savings — gone.
 *                        Each has its own page, reachable from the channel strip.
 *   Department rails   → the tabs above the endless grid, and now on every
 *                        device rather than desktop only.
 *   Picked for you     → unchanged, and it is still the floor of the page.
 *   Recently viewed    → unchanged.
 *   About the shop     → unchanged.
 *
 * Nothing in `lib/home-feed.ts` moved. It composes the same eight pools for the
 * same two readers — this page and `/api/app/home` — and the phone app is
 * untouched by any of this.
 */
export default async function Home() {
  /**
   * Every shelf on this page is composed in `lib/home-feed.ts`, not here.
   *
   * It moved there when the Flutter app started needing the same merchandising:
   * the ordering, the cut-offs and the no-product-appears-twice rule are
   * decisions, and a decision duplicated in two places is a decision that will
   * eventually disagree with itself. This page renders the result;
   * `/api/app/home` serialises the same result for the app. Neither one decides
   * anything.
   *
   * `dailyDeals`, `stores`, `storeCount` and `proof` are computed and not
   * destructured here — the app reads them, and it is a separate reader with
   * its own reasons.
   */
  const {
    settings,
    departments,
    trending,
    departmentRails,
    latest,
    latestTotalPages,
    deals,
    bestSellers,
  } = await buildHomeFeed();

  /** Brand plus suffix, spaced — for the closing about block. */
  const brand = brandName(settings);

  /* ---- The shop's own picks lead the endless grid ----

     `trending` is the only pool on this page the shop chooses by hand: it is
     WooCommerce's featured flag, falling back to newest when nothing is
     flagged. It used to open the page as a carousel of its own. Putting it at
     the head of "For you" instead is not a demotion — it is the first thing in
     the grid every shopper scrolls, on every device, where the carousel was one
     swipe most of them never made.

     Deduplicated by id, because `trending` and `latest` are drawn from the same
     catalogue and overlap whenever the shop has featured something recent. A
     grid whose first row repeats four screens down reads as products failing to
     load. */
  const forYou = [...trending, ...latest].filter(
    (product, index, all) =>
      all.findIndex((other) => other.id === product.id) === index
  );


  /* The departments, as tabs rather than as five stacked rails. A department
     the shop has not created does not appear, and neither does one with fewer
     than twenty products in it — the threshold is
     `DEPARTMENT_CATALOGUE_MINIMUM` in lib/home-feed.ts, and it exists because a
     tab is an invitation to browse a section a shopper can exhaust in one
     screen otherwise. */
  const tabs: PickedTab[] = departmentRails.map((department) => ({
    id: department.id,
    title: department.title,
    slug: department.slug,
    products: department.products,
  }));

  return (
    <main className="pb-20">
      {/* ---- What is actually on this page, told to Google ----

           Every entry is a product this page renders, in the order a reader
           meets them: the "Just in" panel first, then the grid. Capped at 50
           by `itemListJsonLd` itself, which is the point at which a list stops
           summarising a page and starts dumping a catalogue — the sitemap is
           where the whole catalogue belongs.

           It renders inside `<main>` rather than in `generateMetadata`, because
           the list depends on `buildHomeFeed` and duplicating that call in the
           metadata export would double the work for one script tag. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            itemListJsonLd(
              `${brand} — shop online in Uganda`,
              "/",
              [...latest.slice(0, 6), ...forYou]
                .filter(
                  (product, index, all) =>
                    all.findIndex((other) => other.id === product.id) === index
                )
                .map((product) => ({
                  name: product.name,
                  path: productPath(product),
                }))
            )
          ),
        }}
      />

      {/* Phone spacing is deliberately tighter than the desktop step below it.
          16px between shelves and 12px of gutter is a desktop rhythm applied to
          a screen a quarter the width: it pushed roughly one tile-row of
          merchandise below the fold on every scroll. 12px and 10px keeps the
          shelves reading as separate objects — they each paint a white panel,
          which is what actually separates them — while giving the grid its
          width back.

          The desktop step came down with it in the same pass that tightened
          `.shop-panel`: 24px between shelves rather than 32, and 14px of
          vertical page padding rather than 20. Twelve shelves at 8px saved
          apiece is a screenful, and the panels each paint their own ground, so
          what separates two sections is the seam between two white blocks
          rather than the size of the gap between them. */}
      <div className="mx-auto flex max-w-[var(--shell)] flex-col gap-2.5 px-0 py-2 md:gap-4 md:px-8 md:py-3.5">
        {/* ---- The opening screen, in the order a shopper asks the questions ----

            No hero banner: the channel strip says where to go, then the band —
            departments, the deepest cuts with prices showing, and the account. */}
        <ChannelRow />

        <PortalBand
          settings={settings}
          departments={departments}
          newest={latest}
          deals={deals}
          bestSellers={bestSellers}
        />

        <PickedForYou
          latest={forYou}
          newest={latest}
          latestTotalPages={latestTotalPages}
          tabs={tabs}
        />

        {/* The shopper's own trail, handed back to them. It renders nothing at
            all when the list is empty, so a first-time visitor never meets an
            empty shelf, and it reads from `kandi-recently-viewed-v1` in their own
            browser — the same place the product page writes it. */}
        <RecentlyViewed className="" />

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
            className="text-[14px] leading-snug text-shop-body md:text-[15px]"
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
            <span className="block text-[16px] font-bold text-shop-ink md:text-[17px]">
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

          <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-shop-body">
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
