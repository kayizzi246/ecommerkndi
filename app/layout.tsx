import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
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
 * ---- The shop's type: Inter for reading, Poppins for finding ----
 *
 * Two faces, and the split is by JOB rather than by element:
 *
 *   INTER   everything a shopper reads or scans a word at a time — product
 *           names, prices, body copy, form fields, navigation, the meta lines
 *           under a tile. It is a neo-grotesque drawn for interface use at
 *           small sizes, which is exactly what a page of 12–14px catalogue
 *           text is, and its figures are even enough that a column of UGX
 *           prices lines up down a grid.
 *
 *   POPPINS everything that is FOUND rather than read — "Trending now", a page
 *           headline, the hero. Geometric and near-circular, so a section title
 *           stays legible at a glance halfway down a page of photographs, and
 *           its weight reads as personality rather than as emphasis.
 *
 * That is the marketplace idiom: the merchandise supplies the character, the
 * body face gets out of its way, and the display face appears only where the
 * page needs to be navigated rather than read.
 *
 * ---- What this costs, stated plainly ----
 *
 * Inter is a VARIABLE font: one file covers 100–900, so every weight the shop
 * uses — 400 body, 500, 600 product names, 700, 800 prices — is free once that
 * file has landed. Nothing in the reading face ever needs to be argued over
 * again.
 *
 * Poppins is NOT. Google ships it as static instances, so every weight is its
 * own download, which is why the array below is exactly two entries and not the
 * nine on offer. 700 is the weight the heading rule in `globals.css` forces on
 * every h1–h6, `.section-title`, `.hero-display` and `.heading-*`; 600 is the
 * quieter step for the few titles that ask for it. There is no 400, 500 or 800
 * Poppins in this shop, and adding one costs a Ugandan shopper another file on
 * the critical path — check it is genuinely used first.
 *
 * `font-synthesis-weight: none` in `globals.css` is what makes that list
 * load-bearing rather than advisory: a weight that was not downloaded is not
 * smeared into existence, it silently renders as a neighbour. So a Poppins
 * weight that is missing here does not look broken, it looks *untouched* —
 * which is far harder to notice.
 *
 * ---- The delivery, which is why a webfont is affordable at all ----
 *
 *   • `next/font/google` downloads the files at BUILD time and serves them from
 *     this origin. No request reaches Google from a shopper's browser, so there
 *     is no third-party DNS lookup or handshake on the critical path, and
 *     nothing to add to the CSP in next.config.ts.
 *   • `display: "swap"` paints text immediately in the fallback and repaints
 *     when the face lands. Nobody waits on a blank page.
 *   • `adjustFontFallback` (on by default) generates a metric-matched fallback
 *     `@font-face`, so the swap does not reflow a price or a product name.
 *
 * `variable` rather than `className`: the families are handed to CSS as
 * `--font-inter` and `--font-poppins`, and `globals.css` points `--font-ui` and
 * `--font-display` at them. Those two names are the seam that has now made five
 * typeface changes a two-line edit here instead of a search through two hundred
 * components. Do not collapse them.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  /* No `weight` array on purpose: naming any weight makes `next/font` fetch
     STATIC instances, one file each. Omitting it takes Inter's variable file —
     one download covering 100–900, and every step of the scale free. */
});

const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
  /* Two files, and both are used: 700 is what the heading rule forces on every
     h1–h6 and section title, 600 is the quieter step. Poppins has no variable
     file, so each entry here is a real download — see the note above before
     adding a third. */
  weight: ["600", "700"],
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
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
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
