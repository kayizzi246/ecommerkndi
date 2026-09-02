import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
      intro="Enter your order number and the phone or email you ordered with. No account needed."
    >
      {/* `TrackOrderPanel` reads the query string, so it needs a boundary: a
          component calling `useSearchParams` opts its whole subtree out of
          static rendering, and without this the page would be rendered on
          demand on every visit for the sake of two optional parameters. */}
      <Suspense fallback={<div className="h-64 animate-skeleton rounded-2xl bg-shop-hairline" />}>
        <TrackOrderPanel />
      </Suspense>

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

      <InfoSection title="Can&rsquo;t find your order?">
        <p>
          The order number is in the confirmation email we sent when you ordered — it is the
          number after the # . Use the same phone number or email address you gave at checkout;
          if you typed a different one by mistake, the lookup will not match.
        </p>
        <p>
          Still stuck? Call{" "}
          <a href={`tel:${support.phone.replace(/\s/g, "")}`}>{support.phone}</a> or email{" "}
          <a href={`mailto:${support.email}`}>{support.email}</a> and we will find it for you.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
