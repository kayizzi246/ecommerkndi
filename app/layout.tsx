import type { Metadata } from "next";
import { Roboto, Outfit } from "next/font/google";
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
 * ---- The shop's type: Poppins, one face, everywhere ----
 *
 * ONE face rather than a display/body pair. This shop has been through the
 * system stack, Inter, Open Sans, and a Montserrat-over-Roboto pairing, and the
 * argument for landing on a single geometric face is not that pairing is wrong
 * — it is that this page is already carrying a great deal visually. A product
 * grid is photography, prices, discount flags, badges, tinted rails and orange.
 * A second typeface is one more thing competing in that frame, and the thing it
 * competes with is the merchandise. One face across headings, prices, navigation
 * and body is what makes the page read as one designed object instead of a
 * template with sections bolted on.
 *
 * Poppins specifically because it is geometric and even-width, which is what
 * gives a marketplace personality next to the brand orange without the
 * headings having to shout. It is the modern-storefront idiom rather than the
 * functional-app one.
 *
 * The SCALE — which element is set at which weight and size — is the
 * AliExpress-style spec written out in full at the head of the type block in
 * `globals.css`, and it is unchanged across every one of these moves. Which
 * face carries it is a separate decision, and only that one keeps moving.
 *
 * ---- THREE COSTS, all real, all accepted deliberately ----
 *
 * 1. FIVE FILES, NOT ONE. Poppins is not a variable font in the version of the
 *    Google font data bundled with this Next install — it ships as static
 *    instances. Inter, Montserrat and Roboto were all variable, so each of them
 *    was ONE download covering 100–900. Poppins is one download PER WEIGHT.
 *
 *    That is why the `weight` array below is exactly five entries and not the
 *    nine Google offers. Every one of them is a weight this shop actually sets:
 *
 *      400  body copy, product names, search field, was-prices, meta notes
 *      500  category names, `font-medium`
 *      600  navigation, section subtitles, buttons, `font-semibold`
 *      700  headings, prices, section titles
 *      800  hero display, product-page titles, `font-extrabold`
 *
 *    Adding a sixth costs a Ugandan shopper another file on the critical path
 *    for nothing. Before adding one, check it is genuinely used — the tally that
 *    produced this list is `font-(normal|medium|semibold|bold|extrabold)` across
 *    `app/` and `components/`, plus the `font-weight` declarations in
 *    `globals.css`. There is no 100/200/300 and no 900 anywhere in the shop.
 *
 * 2. WIDTH. Poppins is geometric, which means round letterforms and wide
 *    sidebearings — it sets meaningfully wider per character than Inter or
 *    Roboto. The product name row is a fixed two lines in a tile about 150px
 *    across on a phone, so a wider face fits fewer characters before the
 *    ellipsis, and a supplier's 90-character title now truncates a word or two
 *    earlier than it did. That is the price of the personality, and it is paid
 *    on every tile in the shop. If titles start looking badly clipped, the
 *    lever is the tile's name row, not the face.
 *
 * 3. FIGURES. `.price` asks for `tabular-nums` and Poppins ships no true
 *    tabular set. Its digits are geometric and near-uniform in width so a
 *    column of UGX prices still lines up in practice; the request is left in
 *    place because it costs nothing and starts working the moment the face
 *    changes again.
 *
 * What has NOT changed is the delivery, and it is the reason a webfont is
 * affordable on a Ugandan mobile connection at all:
 *
 *   • `next/font/google` downloads the files at BUILD time and serves them from
 *     this origin. No request reaches Google from a shopper's browser, so there
 *     is no third-party DNS lookup or handshake on the critical path, and
 *     nothing to add to the CSP in next.config.ts.
 *   • `display: "swap"` means text paints immediately in the fallback and is
 *     repainted in Poppins when it lands. Nobody ever sees a blank page waiting
 *     on a font.
 *   • `adjustFontFallback` (on by default) generates a metric-matched fallback
 *     `@font-face`, so the swap does not reflow a single price or product name.
 *
 * `variable` rather than `className`: the family is handed to CSS as
 * `--font-poppins`, which `globals.css` puts at the head of BOTH `--font-ui`
 * and `--font-display`, with the system stack still behind it as the fallback.
 * Those two names are kept even though they now resolve to one family — it is
 * what made this swap a two-line change instead of a search through two hundred
 * components, and it is what will make the next one cheap too.
 */
const roboto = Roboto({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
  /* ---- No `weight` array, on purpose: this is the VARIABLE file ----
   *
   * It used to name four weights — 400, 500, 700, 900 — and naming any weight
   * is what makes `next/font` fetch STATIC instances instead. That is four
   * separate downloads, and it is the reason the list was kept short and every
   * addition argued over: a fifth weight was a fifth file on the critical path
   * for a shopper on a Ugandan mobile connection.
   *
   * Roboto ships a variable font covering 100–900 in ONE file. Omitting
   * `weight` takes it, which is fewer requests than the four statics AND makes
   * every step in between free — 600 for a semibold product name, 800 for a
   * price — where before each one was a new file to justify.
   *
   * This matters more than it looks, because `font-synthesis-weight: none` in
   * globals.css means a weight that was not loaded is not faked: it silently
   * renders as a neighbouring weight and the type looks untouched. With four
   * statics, half the scale was quietly unavailable. With the variable file
   * there is nothing to get wrong. */
});

/**
 * Outfit — the DISPLAY face. Headings, section titles and prices.
 *
 * Two faces again, and the split is the reason it is worth the second file.
 * Roboto keeps the reading: product names, body copy, form labels, everything
 * a shopper works through a word at a time, where a neo-grotesque drawn for
 * interface use is exactly right and a geometric face is not.
 *
 * Outfit takes the type that is FOUND rather than read — "Trending now", a
 * price, a page headline. It is geometric, near-circular and very even in
 * colour, which is what makes a section title legible at a glance halfway down
 * a page of photographs, and its heavy weights stay open where Roboto's close
 * up.
 *
 * Four weights, all of them used: 500 nowhere near a heading (it is there for
 * `.category-name`-style display text), 600 for the quieter titles, 700 for
 * the section headings, 800 for prices and the /sell hero. Nothing loads that
 * the stylesheet does not ask for — `font-synthesis-weight: none` means an
 * absent weight silently renders as another one rather than being faked.
 */
const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
  /* The variable file here too, and for the same reason as Roboto above: four
     named weights are four downloads, where the variable Outfit is one file
     covering 100–900. See the note in the Roboto block. */
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
     * `apple-icon.png` has now followed them, and for the third time this file
     * has to record the same lesson. It stayed in `app/` after the other two
     * left, which is still a Next file convention, so every page shipped
     *
     *   <link rel="apple-touch-icon" href="/apple-icon.png?…" sizes="…">
     *
     * alongside the `apple` link this function declares — two apple icons, one
     * of them the bundled image that never changes. That is the same "faced
     * with two, something else picks one" bug as before, and it is not only an
     * iOS concern: Google's favicon crawler reads apple-touch-icon as a
     * candidate too, so a stale one is a stale icon in search results. It lives
     * in `public/` now, still answers `/apple-icon.png` for the fallback branch
     * below, and is no longer advertised on its own.
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
     * `/favicon.ico` no longer exists as a file at all. It is rewritten to
     * `/brand-icon` in next.config.ts, so the bare request browsers and Google's
     * favicon crawler make by habit now returns the same image this function
     * declares.
     *
     * That was the last URL that could disagree. The static file used to be a
     * multi-frame icon of the older orange "K" — a real Kandi mark, which is
     * why nothing looked broken, and the wrong one, because it was generated
     * once and left behind while the logo in wp-admin moved on. A shop owner
     * replacing their logo saw the tab change and the search result stay.
     */
    /**
     * ---- The fallback branch now names ONE url too ----
     *
     * It used to read `apple: "/apple-icon.png"` while `icon` and `shortcut`
     * pointed at `/icon.png` — two different images declared on the same page,
     * which is the exact shape of the bug the four paragraphs above exist to
     * describe, surviving in the branch nobody looks at.
     *
     * It matters for search specifically. Google's favicon crawler treats
     * `apple-touch-icon` as a candidate alongside `rel="icon"`, so a shop with
     * no upload was still handing it two pictures and letting it choose. Both
     * files are the same 512×512 square mark, so nothing visible was wrong —
     * which is why it lasted. One URL, in both branches, is the rule.
     *
     * `public/apple-icon.png` stays on disk: it is still served at that path
     * for anything requesting it by habit, it is simply no longer declared.
     *
     * No `type` or `sizes` on any of these, deliberately. `/brand-icon` proxies
     * whatever wp-admin holds, so its content type and dimensions are whatever
     * was uploaded — declaring `image/png` on a JPEG upload would be a lie the
     * browser has to work around, and a wrong `sizes` is worse than none.
     */
    icons: favicon
      ? { icon: "/brand-icon", shortcut: "/brand-icon", apple: "/brand-icon" }
      : { icon: "/icon.png", shortcut: "/icon.png", apple: "/icon.png" },
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
      // `poppins.variable` defines `--font-poppins` on the root element, where
      // every rule in globals.css can reach it. The class carries no
      // `font-family` of its own — the stylesheet decides what uses the face —
      // which is why the Seller Centre and admin shells pick it up too without
      // being touched.
      className={`${roboto.variable} ${outfit.variable} h-full antialiased`}
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
