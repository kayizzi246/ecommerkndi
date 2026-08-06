import type { Metadata } from "next";
import { Jost, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@/lib/toast";
import { getCategories, buildCategoryTree } from "@/lib/woocommerce";
import { CustomerSessionProvider } from "@/lib/customer-session";
import StoreChrome from "@/components/StoreChrome";

// Jost: geometric display face used across the whole Brands For Less look.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

// Inter: fallback face for dense tabular UI in the Seller Centre.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Kandi Store | Online Shopping in Uganda",
    template: "%s | Kandi Store",
  },
  description:
    "Shop original brand shoes, fashion and more for less. Fast delivery across Uganda, pay on delivery.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const departments = buildCategoryTree(await getCategories());

  return (
    <html
      lang="en"
      className={`${jost.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white">
        <CustomerSessionProvider>
          <CartProvider>
            <ToastProvider>
              <StoreChrome departments={departments}>{children}</StoreChrome>
            </ToastProvider>
          </CartProvider>
        </CustomerSessionProvider>
      </body>
    </html>
  );
}
