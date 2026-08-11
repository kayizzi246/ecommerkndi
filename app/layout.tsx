import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@/lib/toast";
import { getCategories, buildCategoryTree } from "@/lib/woocommerce";
import { CustomerSessionProvider } from "@/lib/customer-session";
import StoreChrome from "@/components/StoreChrome";
import { getSiteSettings, getFaviconUrl } from "@/lib/site-settings";
import { siteJsonLd, siteUrl } from "@/lib/seo";

/**
 * Poppins carries everything that has to shout: the KandiUg wordmark, section
 * headings, promotional type, prices and large buttons.
 *
 * It is a geometric sans — circular bowls, even strokes — which is why it reads
 * as confident rather than corporate at 600–800, and why a price set in it holds
 * its own against a photograph. Only the five weights the store actually uses
 * are loaded; Poppins has no variable axis on Google Fonts, so every extra
 * weight is another file over the wire.
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

/**
 * Inter carries everything that has to be read rather than noticed: navigation,
 * product names, descriptions, filters, form labels, table figures.
 *
 * At 13–14px — which is most of a marketplace — Inter's taller x-height and
 * narrower set make it plainly more legible than a geometric face, whose wide
 * round letterforms cost horizontal room a product title cannot spare.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
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
  const brand = `${settings.brand.name}${settings.brand.suffix}`.trim();

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
    // The uploaded favicon, when there is one worth using — see getFaviconUrl.
    // Otherwise nothing is declared here and the icons that ship in `app/`
    // (favicon.ico, icon.png, apple-icon.png) carry the tab on their own, so it
    // is never blank. `apple` is the same image: iOS uses it when somebody saves
    // the shop to their home screen.
    icons: favicon
      ? { icon: favicon, shortcut: favicon, apple: favicon }
      : undefined,
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

  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable} h-full antialiased`}
    >
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
              siteJsonLd(`${settings.brand.name}${settings.brand.suffix}`.trim())
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
      </body>
    </html>
  );
}
