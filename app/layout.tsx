import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@/lib/toast";
import { getCategories, buildCategoryTree } from "@/lib/woocommerce";
import { CustomerSessionProvider } from "@/lib/customer-session";
import StoreChrome from "@/components/StoreChrome";
import { getSiteSettings, getFaviconUrl, brandName } from "@/lib/site-settings";
import { siteJsonLd, siteUrl } from "@/lib/seo";

/**
 * Plus Jakarta Sans carries the whole store — headings, navigation, product
 * names, prices, forms, tables.
 *
 * One face rather than the Poppins/Inter pair the store used to run. Two
 * families only earn their weight when they are doing genuinely different jobs,
 * and here they were not: the same heading, price and label treatments were
 * being reproduced in both, which is how a page ends up looking assembled from
 * two templates. Jakarta is a humanist-geometric sans with a tall x-height, so
 * it does the job Inter was here for at 13–14px while still reading as
 * confident display type at 700–800, which is what Poppins was here for.
 *
 * A variable font, so every weight from 200 to 800 arrives in a single file —
 * loading the heavy cuts costs nothing extra over the wire, and
 * `font-synthesis-weight: none` in globals.css means any weight that renders is
 * a real one.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
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
      className={`${jakarta.variable} h-full antialiased`}
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
              siteJsonLd(brandName(settings))
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
