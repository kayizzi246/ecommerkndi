import type { Metadata } from "next";
import { Jost, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@/lib/toast";
import { getCategories } from "@/lib/woocommerce";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppBanner from "@/components/AppBanner";

// Jost: geometric display face for headings, prices, buttons (Brands For Less look).
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

// Inter: highly readable body text.
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
  const categories = await getCategories();

  return (
    <html
      lang="en"
      className={`${jost.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <ToastProvider>
            <Header categories={categories} />
            <div className="flex-1">{children}</div>
            <Footer />
            <AppBanner />
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}
