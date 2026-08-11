import { getSiteSettings } from "@/lib/site-settings";
import SetupGate from "./SetupGate";

export const metadata = {
  title: "Finish setting up",
  robots: { index: false, follow: false },
};

/**
 * The setup gate: everything a new seller must finish before the Seller Centre
 * opens to them — identity and business verification, then the joining fee.
 *
 * A server component only to read the shop's own terms, which live in wp-admin.
 * The steps themselves are client work.
 */
export default async function SellerOnboardingPage() {
  const settings = await getSiteSettings();

  return (
    <SetupGate
      registrationFee={settings.seller.registration_fee}
      payNumber={settings.seller.pay_number}
      payName={settings.seller.pay_name}
    />
  );
}
