import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { InfoSection } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";
import TrackOrderPanel from "./TrackOrderPanel";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Track your order",
  description: "See where your Kandi UG order has got to.",
};

export default async function TrackOrderPage() {
  const { support } = await getSiteSettings();

  return (
    <InfoPage
      eyebrow="Customer service"
      title="Track your order"
      intro="Every order placed with your account, with its live status straight from the warehouse."
    >
      <TrackOrderPanel />

      <InfoSection title="What the statuses mean">
        <ul>
          <li>
            <strong>Being prepared</strong> — we have your order and are picking and packing it.
          </li>
          <li>
            <strong>On hold</strong> — we need something from you, usually a confirmation of the
            delivery address. We will have called.
          </li>
          <li>
            <strong>Delivered</strong> — the courier has handed it over. Anything wrong with it?
            You have time to <Link href="/returns">return it</Link>.
          </li>
          <li>
            <strong>Cancelled or refunded</strong> — the order was stopped and no money is owed.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Ordered as a guest?">
        <p>
          Guest orders are not tied to an account, so they do not appear here. Call{" "}
          <a href={`tel:${support.phone.replace(/\s/g, "")}`}>{support.phone}</a> or email{" "}
          <a href={`mailto:${support.email}`}>{support.email}</a> with your order number and we
          will look it up. Next time, sign in before checking out and everything lands here
          automatically.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
