import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@/lib/toast";
import { getCategories, buildCategoryTree, wordpressOrigin } from "@/lib/woocommerce";
import { CustomerSessionProvider } from "@/lib/customer-session";
import { CommerceTermsProvider } from "@/lib/commerce-terms";
import StoreChrome from "@/components/StoreChrome";
import { getSiteSettings, getFaviconUrl, brandName } from "@/lib/site-settings";
import { siteJsonLd, siteUrl, absolute } from "@/lib/seo";

/**
 * ---- The shop's type: Inter, self-hosted ----
 *
 * The face is Inter. The SCALE — which element is set at which weight and size —
 * is the AliExpress-style spec written out in full at the head of the type block
 * in `globals.css`, and it is unchanged. Those are two separate decisions and
 * only the first one moved.
 *
 * ---- Why Inter and not Open Sans ----
 *
 * This shop has been through the system stack, Inter, Open Sans and back, so the
 * reasoning is worth pinning down in terms of the thing being sold rather than
 * taste. Three arguments, all about the product grid:
 *
 * 1. WIDTH. Open Sans sets wider per character. The product name row is a fixed
 *    two lines in a tile about 150px across on a phone, so a wider face fits
 *    fewer characters before the ellipsis — and a supplier's 90-character title
 *    truncating a word or two earlier, on every tile, is the most direct way
 *    type makes a catalogue look worse.
 *
 * 2. FIGURES. `.price` asks for `tabular-nums`. Inter draws a real tabular set;
 *    Open Sans approximates one. In a grid of prices that is the difference
 *    between a column that lines up and one that very slightly does not — and
 *    price is the number every other decision on the tile is in service of.
 *
 * 3. INTENT. Inter was drawn for interface text at 12–14px, which is exactly
 *    where this grid lives. Open Sans (2011) was drawn for web body copy and is
 *    doing a job next to the one it was made for.
 *
 * What Open Sans had going for it — humanist, large x-height, open apertures,
 * legible small — Inter has too. It is not a downgrade on any of those.
 *
 * The commissioned faces the big marketplaces actually ship (Amazon Ember,
 * eBay's Market Sans — both Dalton Maag) are not licensable, and Inter is the
 * closest open equivalent to both.
 *
 * The engineering that made a webfont affordable here is unchanged:
 *
 *   • `next/font/google` downloads the file at BUILD time and serves it from
 *     this origin. No request reaches Google from a shopper's browser, so there
 *     is no third-party DNS lookup or handshake on the critical path, and
 *     nothing to add to the CSP in next.config.ts.
 *   • One variable file covers the whole scale. Inter is variable across
 *     100–900 and the spec runs 400 to 800, so every weight the stylesheet asks
 *     for is real rather than synthesised — and it is one download, not five.
 *   • `display: "swap"` means text paints immediately in the fallback and is
 *     repainted in Inter when it lands. A Ugandan mobile connection never sees
 *     a blank page waiting on a font.
 *   • `adjustFontFallback` (on by default) generates a metric-matched fallback
 *     `@font-face`, so the swap does not reflow a single price or product name.
 *
 * `variable` rather than `className`: the family is handed to CSS as
 * `--font-inter`, which `globals.css` puts at the head of `--font-ui` with the
 * system stack still behind it as the fallback.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  /**
   * The optical-size axis, pinned by its own range to the 14px default.
   *
   * Inter's `opsz` retunes the letterforms for the size they are set at, and
   * 14px is the workhorse of this grid — product names, navigation, category
   * labels and the search field are all at or near it.
   */
  axes: ["opsz"],
});

/**
 * Site-wide metadata, read from wp-admin.
 *
 * A function rather than a constant because the brand name, tagline and favicon
 * all live in *Kandi Storefront* — a shop that renames itself should not need a
 * redeploy to change what the browser tab says.
 *
 * `getSiteSettings` is called here and again in the layout body. Next dedupes
 * identical fetches within a render, so it is one request, not two.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [settings, favicon] = await Promise.all([getSiteSettings(), getFaviconUrl()]);
  const brand = brandName(settings);

  return {
    // `metadataBase` makes every relative Open Graph image resolve to an
    // absolute URL. Without it, a product link pasted into WhatsApp — how most
    // shoppers here share — shows no picture at all.
    metadataBase: new URL(siteUrl()),
    title: {
      default: `${brand} | Online Shopping in Uganda — Fast Delivery, Pay on Delivery`,
      template: `%s | ${brand}`,
    },
    description: settings.brand.tagline
      ? `${settings.brand.tagline} Pay on delivery, ${settings.commerce.returns_days}-day returns.`
      : "Shop shoes, fashion, electronics and more at low prices. Fast delivery across Uganda.",
    applicationName: brand,
    /**
     * The tab icon — and the *only* declaration of it on the page.
     *
     * That exclusivity is the fix for "I upload a favicon in Store Settings and
     * nothing changes".
     *
     * The uploaded icon was always reaching the HTML. What it was competing with
     * was a second icon the framework emitted on its own: `favicon.ico` and
     * `icon.png` used to sit in `app/`, where they are a Next file convention,
     * so every page shipped BOTH the wp-admin PNG and
     * `<link rel="icon" href="/favicon.ico" sizes="48x48" type="image/x-icon">`.
     * Faced with two, a browser picks one — and Chrome prefers the `.ico` with
     * an explicit `sizes`, which is the bundled one that never changes. The
     * upload worked; it was simply never the icon that won.
     *
     * Both files have moved to `public/`, which serves them at the same URLs but
     * stops Next advertising them. `/favicon.ico` therefore still answers the
     * bare request browsers and crawlers make by habit, while the only icon
     * *declared* in the head is the one this function chooses.
     *
     * The fallback is explicit for the same reason: with nothing in `app/` there
     * is no automatic icon behind us any more, so a shop that has not uploaded
     * one must be given the bundled image by name or it would ship no icon at
     * all. `apple` is the same image — iOS uses it when the shop is saved to a
     * home screen.
     *
     * Note the upload can still be declined: `getFaviconUrl` returns null for a
     * PNG whose sides differ by more than 1.6× (a wide logo makes an unreadable
     * 16px tab icon). If an upload appears to do nothing, that is now the first
     * thing to check — crop it square.
     */
    /**
     * ---- Every icon URL here is now on this origin ----
     *
     * These used to be the wp-admin URL itself, which meant the icon Google
     * crawls lived on `shop.kandiug.com` under a path containing the month of
     * the upload and the original filename — a URL that changes completely
     * every time the shop replaces its logo. Google crawls favicons on their
     * own schedule and wants the address to stay put; a moving one can cost
     * weeks of search results with no icon beside them.
     *
     * `/brand-icon` is a route on this site that serves whatever wp-admin
     * currently points at, so the upload still works and the URL never moves
     * again. See `app/brand-icon/route.ts`.
     *
     * ---- All three point at the SAME URL, and that is not an oversight ----
     *
     * This briefly read `shortcut: "/favicon.ico"`, on the reasoning that a
     * real .ico with 16/32/48px frames is the one format every crawler can
     * read without negotiation. That reasoning is true and it does not matter,
     * because it re-broke the exact bug the paragraphs above exist to describe.
     *
     * Declaring two different icons means the browser picks one, and Chrome
     * prefers the `.ico` — which is the bundled file that never changes. The
     * result on the live site was a head containing both the uploaded logo and
     * the stock icon, with the stock one winning: the upload reached the page
     * every time and was simply never what got painted. That is the second
     * time this shop has lost its favicon to a second declaration, and the
     * rule it keeps teaching is worth stating plainly — ONE icon, one URL, no
     * alternatives for a browser to choose between.
     *
     * `/favicon.ico` still exists in `public/` and still answers the bare
     * request browsers and crawlers make by habit. It is just not *declared*
     * any more, so it cannot outrank the icon this function chose.
     */
    icons: favicon
      ? { icon: "/brand-icon", shortcut: "/brand-icon", apple: "/brand-icon" }
      : { icon: "/icon.png", shortcut: "/icon.png", apple: "/apple-icon.png" },
    // No canonical here, deliberately.
    //
    // Metadata set in a layout is *inherited* by every page under it that does
    // not override it. This used to say `canonical: "/"`, which meant /sale,
    // /sellers, /sell and every policy page shipped a tag telling Google they
    // were duplicates of the homepage — an instruction not to index them. Only
    // products and categories set their own, so only they were indexable.
    //
    // Canonicals now live on the pages themselves, where the URL is known. A
    // page that declares none is self-canonical to Google, which is the right
    // default; a page that must not be indexed says so with `robots` instead.
    openGraph: {
      type: "website",
      siteName: brand,
      locale: "en_UG",
    },
    twitter: { card: "summary_large_image" },
    robots: {
      index: true,
      follow: true,
      // Lets Google show a full text snippet and a large image thumbnail
      // instead of clipping both to its conservative defaults.
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [departments, settings] = await Promise.all([
    getCategories().then(buildCategoryTree),
    getSiteSettings(),
  ]);

  const mediaOrigin = wordpressOrigin();

  return (
    <html
      lang="en"
      // `inter.variable` defines `--font-inter` on the root element,
      // where every rule in globals.css can reach it. The class carries no
      // `font-family` of its own — the stylesheet decides what uses the face —
      // which is why the Seller Centre and admin shells pick it up too without
      // being touched.
      className={`${inter.variable} h-full antialiased`}
    >
      {/* ---- Open the connection to the media host before it is needed ----
           Every product photograph on every page comes from the WordPress media
           library, and the first one cannot start downloading until the browser
           has done a DNS lookup, a TCP handshake and a TLS negotiation with
           that host — three round trips it only begins once it has parsed far
           enough to find an <img>. On a Ugandan mobile connection that is
           comfortably 300–600ms of dead time before a single pixel moves.

           `preconnect` starts those three round trips while the HTML is still
           arriving, so the connection is warm by the time the first tile asks
           for its file. `dns-prefetch` is the fallback for the browsers that
           ignore preconnect hints.

           The host is derived from WP_API_URL rather than typed, so it cannot
           drift away from where the images actually live.

           ---- Why there is no <head> element around these ----

           There used to be, and it is what broke the favicon.

           A root layout must not render its own `<head>`: the App Router owns
           that element and injects into it everything the Metadata API and the
           `app/` file conventions produce — which includes the icon links
           generated from `favicon.ico`, `icon.png` and `apple-icon.png`. Adding
           an explicit `<head>` hands React a head of our own, and the generated
           icon links stopped being emitted with it. The files were all present
           and valid the whole time; nothing was ever pointing at them.

           These two hints do not need a wrapper anyway. React hoists `<link>`
           into the document head from wherever it is rendered, so they land in
           exactly the same place — alongside the metadata rather than instead of
           it. */}
      {mediaOrigin && (
        <>
          <link rel="preconnect" href={mediaOrigin} crossOrigin="" />
          <link rel="dns-prefetch" href={mediaOrigin} />
        </>
      )}
      {/* `bg-background`, not `bg-white`. Hard-coding white here painted over
          the `--background` token on every page, which is why changing that
          token appeared to do nothing at all. */}
      <body className="min-h-full flex flex-col bg-background">
        {/* Tells Google what this site is and that it has a search endpoint —
            the prerequisite for a sitelinks search box under the homepage
            result. Rendered once, in the layout, so it is on every page. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              siteJsonLd(brandName(settings), {
                // The three spellings people actually type. `brand.name` and
                // the full name are included so that whichever one wp-admin is
                // set to, the other still resolves to this shop — the aliases
                // are filtered against the primary name inside `siteJsonLd`.
                alternateNames: [
                  settings.brand.name,
                  `${settings.brand.name} UG`,
                  "KandiUg",
                  "Kandi UG",
                  "Kandi",
                ],
                // The uploaded logo when there is one, otherwise the icon that
                // ships in `app/` — which is 512×512 and square, comfortably
                // past the 48px minimum Google reads a favicon at.
                logo: settings.brand.logo_url || absolute("/icon.png"),
                sameAs: Object.values(settings.social).filter(Boolean),
                phone: settings.support.phone,
              })
            ),
          }}
        />
        {/* The shop's delivery and returns terms, read once here and available
            to every client component below. `getSiteSettings()` is already
            awaited above for the metadata, so this adds no request — it only
            stops the cart, the trust strips and the product page from each
            keeping their own copy of a number the owner can edit in wp-admin.
            See `lib/commerce-terms.tsx` for what that drift cost. */}
        <CommerceTermsProvider
          terms={{
            freeDeliveryFrom: settings.commerce.free_delivery_from,
            returnsDays: settings.commerce.returns_days,
          }}
        >
          <CustomerSessionProvider>
            <CartProvider>
              <ToastProvider>
                <StoreChrome departments={departments} settings={settings}>
                  {children}
                </StoreChrome>
              </ToastProvider>
            </CartProvider>
          </CustomerSessionProvider>
        </CommerceTermsProvider>

        {/* ---- Vercel Analytics and Speed Insights ----
             Page views and real-user performance, both first-party.

             They are last in the body deliberately: neither is needed to render
             the shop, and anything above them in the tree paints first.
             Analytics counts visits; Speed Insights reports the Core Web Vitals
             actual shoppers experience on actual Ugandan connections, which is
             the only measurement of this site's speed that means anything — a
             lab score on a fast laptop has never been the problem.

             Nothing needed adding to the Content-Security-Policy in
             next.config.ts, which is worth recording because it looks like it
             should have. Both scripts are served from `/_vercel/…` on this
             origin and beacon back to the same place, so the existing
             `script-src 'self'` and `connect-src 'self'` already permit them.
             No third-party host is contacted and no cookie is set. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
