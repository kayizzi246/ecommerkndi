import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@/lib/toast";
import { getCategories, buildCategoryTree, wordpressOrigin } from "@/lib/woocommerce";
import { CustomerSessionProvider } from "@/lib/customer-session";
import StoreChrome from "@/components/StoreChrome";
import { getSiteSettings, getFaviconUrl, brandName } from "@/lib/site-settings";
import { siteJsonLd, siteUrl, absolute } from "@/lib/seo";

/**
 * There is no webfont, and no `next/font` call.
 *
 * The shop has now been through four settings: a Poppins/Inter pair, Plus
 * Jakarta Sans, the system stack, a brief run on self-hosted Geist, and back to
 * the system stack — which is where it stays, matched deliberately to
 * brandsforless.com, whose type is `system-ui, -apple-system, …` and nothing
 * else. The stack itself lives in `globals.css`, with the reasoning.
 *
 * What it buys is the whole point. A webfont is a file that must arrive before a
 * word can be painted in its intended shape, and it sits on the critical path in
 * front of the product photographs that are the only reason anybody opened the
 * page. The system face is already resident on the device, so the first paint is
 * the final paint — no download, no swap, no reflow of every price and product
 * name a second into the page's life.
 *
 * The cost is real and worth stating: the shop renders in Segoe UI on Windows,
 * Roboto on Android and SF on iOS, so no two shoppers see quite the same letter
 * shapes. That is the trade every large marketplace has made — Temu, Amazon,
 * AliExpress and Brands For Less all resolve to the reader's own interface font.
 * This shop's identity lives in its logo, its orange and its photography, none
 * of which is type.
 */

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
    icons: favicon
      ? { icon: favicon, shortcut: favicon, apple: favicon }
      : { icon: "/icon.png", shortcut: "/favicon.ico", apple: "/apple-icon.png" },
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
      className="h-full antialiased"
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
        <CustomerSessionProvider>
          <CartProvider>
            <ToastProvider>
              <StoreChrome departments={departments} settings={settings}>
                {children}
              </StoreChrome>
            </ToastProvider>
          </CartProvider>
        </CustomerSessionProvider>

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
