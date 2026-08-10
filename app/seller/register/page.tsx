import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import OnboardingFlow from "./OnboardingFlow";

export const metadata: Metadata = {
  title: "Open your store",
  description: "Set up a Kandi seller account in a few minutes.",
};

/**
 * Seller onboarding. The terms quoted through the flow — the joining fee, the
 * commission rate, the number to pay it to — come from wp-admin, so they are
 * never out of step with the landing page or with what the team actually
 * charges.
 */
export default async function SellerRegisterPage() {
  const { seller } = await getSiteSettings();

  return (
    <OnboardingFlow
      registrationFee={seller.registration_fee}
      commissionRate={seller.commission_rate}
      payNumber={seller.pay_number}
      payName={seller.pay_name}
    />
  );
}
