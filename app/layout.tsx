import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@/lib/toast";
import { getCategories, buildCategoryTree } from "@/lib/woocommerce";
import { CustomerSessionProvider } from "@/lib/customer-session";
import StoreChrome from "@/components/StoreChrome";
import { getSiteSettings } from "@/lib/site-settings";
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

export const metadata: Metadata = {
  // `metadataBase` makes every relative Open Graph image resolve to an absolute
  // URL. Without it, a product link pasted into WhatsApp — how most shoppers
  // here share — shows no picture at all.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "KandiUg | Online Shopping in Uganda — Fast Delivery, Pay on Delivery",
    template: "%s | KandiUg",
  },
  description:
    "Shop shoes, fashion, electronics and more at low prices on KandiUg. Fast delivery across Uganda, pay on delivery, 14-day returns.",
  applicationName: "KandiUg",
  // Every page is canonical to itself unless it says otherwise; product pages
  // override this, which is what stops slug and id URLs competing.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "KandiUg",
    locale: "en_UG",
  },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    // Lets Google show a full text snippet and a large image thumbnail instead
    // of clipping both to its conservative defaults.
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

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
      <body className="min-h-full flex flex-col bg-white">
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
