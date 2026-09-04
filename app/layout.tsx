import type { Metadata, Viewport } from "next";
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
import { getSiteSettings, brandName } from "@/lib/site-settings";
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
 * ---- The shop is light-only, said to the browser rather than to the reader ----
 *
 * A static `viewport` export rather than `generateViewport`, because none of
 * this depends on wp-admin: the answer is the same for every page and every
 * shop, so it can be a constant and cost nothing at request time.
 *
 * `colorScheme: "light"` emits `<meta name="color-scheme" content="light">`.
 * It is the half of the declaration that lands in `<head>` before the
 * stylesheet has parsed; the other half is `color-scheme: light` on `:root` in
 * `globals.css`, and the long note there explains what goes wrong without it —
 * Chrome on Android re-tinting a page that never opted into a dark rendering,
 * which is the reason this storefront could look right in development and
 * arrive dark on a phone in production.
 *
 * `themeColor` is white to match. It colours the browser's own chrome — the
 * address bar on Android, the status bar area of an installed PWA — and a
 * single value rather than a light/dark pair, for the same reason: there is
 * one rendering of this site and this is it.
 *
 * The `width`/`initialScale` defaults Next already emits are left alone. They
 * are correct, and `maximumScale`/`userScalable` are deliberately NOT set —
 * pinch-zoom is how a shopper reads a product photograph or a size chart, and
 * taking it away is an accessibility failure, not a polish step. Stopping the
 * browser zooming *uninvited* when a form field is focused is a separate
 * problem with a separate fix, in globals.css: 16px controls on phones.
 *
 * `interactiveWidget` is the other half of that fix, and it is about what the
 * on-screen keyboard does to the page rather than what focus does to the zoom.
 * By default a phone keyboard OVERLAYS the layout: the page keeps its full
 * height, the bottom third of it is simply underneath the keys, and anything
 * anchored to the bottom of the window — the cart's checkout bar — is invisible
 * exactly while somebody is typing above it. `resizes-content` makes the
 * keyboard take height away from the layout instead, so the visible page really
 * is the visible page: fixed bars sit on top of the keyboard, and a focused
 * field scrolls into a region that exists.
 */
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
  interactiveWidget: "resizes-content",
};

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
  const settings = await getSiteSettings();
  const brand = brandName(settings);

  return {
    // `metadataBase` makes every relative Open Graph image resolve to an
    // absolute URL. Without it, a product link pasted into WhatsApp — how most
    // shoppers here share — shows no picture at all.
    metadataBase: new URL(siteUrl()),
    title: {
      // One separator, and it is the pipe. This carried a pipe AND an em dash
      // — "Brand | Online Shopping in Uganda — Fast Delivery, Pay on Delivery"
      // — which is two punctuation marks doing one job, and the dash is the
      // one that renders as a stray line in a browser tab where the title is
      // clipped to about 25 characters. It also pushed the string past 70,
      // where Google truncates.
      default: `${brand} | Online Shopping in Uganda, Pay on Delivery`,
      template: `%s | ${brand}`,
    },
    description: settings.brand.tagline
      ? `${settings.brand.tagline} Pay on delivery, ${settings.commerce.returns_days}-day returns.`
      : "Shop shoes, fashion, electronics and more at low prices. Fast delivery across Uganda.",
    applicationName: brand,
    /**
     * The tab icon — and the *only* declaration of it on the page.
     *
     * ---- One icon, one URL, no alternatives ----
     *
     * That exclusivity is the fix for a bug this file has now recorded three
     * separate times. `favicon.ico`, `icon.png` and `apple-icon.png` used to
     * sit in `app/`, where they are a Next *file convention* — the framework
     * emits `<link rel="icon">` and `<link rel="apple-touch-icon">` for them on
     * its own, alongside whatever this function declares. Faced with two icons
     * a browser picks one, and Chrome prefers the `.ico` with an explicit
     * `sizes`. The result each time was an icon that reached the HTML and was
     * simply never the one that got painted.
     *
     * All three files live in `public/` now. They are served at the same URLs
     * and are no longer advertised by the framework, so the only icon declared
     * on the page is the one named here. `icon`, `shortcut` and `apple` all
     * point at the same file deliberately: Google's favicon crawler reads
     * `apple-touch-icon` as a candidate too, so three URLs would be three
     * pictures for it to choose between.
     *
     * Nothing may be added to `app/` with those names again, and no second URL
     * may be declared beside this one.
     *
     * ---- Why this is a file and not the wp-admin upload ----
     *
     * It used to be the upload. `icon` pointed at `/brand-icon`, a route
     * handler that fetched whatever the Store Settings favicon field held and
     * proxied it back under this origin. That route was built to solve a real
     * problem — linking the wp-admin URL directly gave Google an address that
     * changed completely every time the shop re-uploaded, because WordPress
     * files an upload under the month it was uploaded and keeps the original
     * filename, and the favicon crawler has to rediscover a moved icon.
     *
     * The stable URL fixed the moving address and left everything else. The
     * icon Google got still depended on a WordPress round trip completing, on
     * the upload being square, on the plugin being installed and on wp-admin
     * being reachable — and every one of those failure modes fell back to a
     * *different* picture. An icon that silently changes is the thing the
     * crawler punishes, and that is a lot of moving parts for one small square
     * that changes maybe once a year.
     *
     * So the mark is a file in the repository now. `/icon.png` is static, on
     * this origin, cannot fail to resolve and cannot disagree with itself.
     * `/favicon.ico` and `/brand-icon` — the address Google has already
     * learned — are both rewritten to it in next.config.ts, so every path a
     * crawler might try by habit returns the same bytes.
     *
     * The cost is that the Store Settings favicon field no longer does
     * anything. Changing this mark now means replacing `public/icon.png` (and
     * `public/apple-icon.png`, its 180px twin) and deploying — which is the
     * right shape for something that belongs to the brand rather than to the
     * catalogue.
     *
     * No `type` or `sizes` here. They would have been a lie while this proxied
     * an arbitrary upload; now they would merely be a second thing to keep in
     * step with the file.
     */
    icons: { icon: "/icon.png", shortcut: "/icon.png", apple: "/icon.png" },
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
      /* No `antialiased`. Tailwind's class is `-webkit-font-smoothing:
         antialiased`, which switches subpixel rendering OFF and draws every
         glyph in greyscale — the single biggest cause of the soft type this
         shop had, on the standard-density Windows and Android screens most of
         its traffic arrives on. The full argument is in globals.css beside the
         `letter-spacing` it used to sit under; the short version is that it
         makes text a shade lighter on a Retina Mac and blurs it everywhere
         else. */
      className={`${inter.variable} ${poppins.variable} h-full`}
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
                // ships in `public/` — 144×144 and square, a multiple of the
                // 48px Google reads a favicon at.
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
