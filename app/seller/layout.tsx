import type { Metadata } from "next";
import { SellerSessionProvider } from "@/lib/seller-session";
import SellerShell from "@/components/seller/SellerShell";

export const metadata: Metadata = {
  title: {
    default: "Seller Centre",
    template: "%s | Kandi Seller Centre",
  },
  description: "Manage your listings, track sales and settle commissions on Kandi.",
};

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SellerSessionProvider>
      <SellerShell>{children}</SellerShell>
    </SellerSessionProvider>
  );
}
