import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { InfoSection, InfoFooterCta } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";

export const metadata: Metadata = {
  alternates: { canonical: "/shipping" },
  title: "Delivery information",
  description: "Delivery times, costs and coverage across Uganda.",
};

export default async function ShippingPage() {
  const { commerce, support } = await getSiteSettings();

  return (
    <InfoPage
      eyebrow="Customer service"
      title="Delivery information"
      intro={`How long delivery takes, what it costs, and what happens if something goes wrong. Free on orders over ${formatPrice(commerce.free_delivery_from)}.`}
    >
      <InfoSection title="How long it takes">
        <ul>
          <li>
            <strong>Kampala and the surrounding area</strong> — 1 to 2 business days.
          </li>
          <li>
            <strong>Elsewhere in Uganda</strong> — 2 to 3 business days, depending on the courier
            route.
          </li>
          <li>
            Orders placed after 4pm, on a Sunday or on a public holiday are picked the next
            working day.
          </li>
        </ul>
        <p>
          You will get a call or a message from the courier before they arrive, so keep the phone
          number on your order reachable.
        </p>
      </InfoSection>

      <InfoSection title="What it costs">
        <ul>
          <li>
            <strong>Free</strong> on orders over {formatPrice(commerce.free_delivery_from)}.
          </li>
          <li>
            Below that, a flat delivery fee is shown at checkout before you pay — it is never
            added afterwards.
          </li>
          <li>
            Orders that include items from more than one marketplace store may arrive in separate
            deliveries. You are only charged delivery once.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Paying on delivery">
        <p>
          You can pay the courier in cash, by MTN Mobile Money or by Airtel Money when the parcel
          arrives, or pay by card at checkout. Check the item before you pay — if it is not what
          you ordered, refuse the delivery and it comes straight back to us at no cost to you.
        </p>
      </InfoSection>

      <InfoSection title="If something goes wrong">
        <p>
          If a delivery is late, damaged or never turns up, tell us and we will chase the courier
          — that is our job, not yours. Track everything you have ordered on your{" "}
          <Link href="/account/orders">orders page</Link>, or call{" "}
          <a href={`tel:${support.phone.replace(/\s/g, "")}`}>{support.phone}</a>.
        </p>
      </InfoSection>

      <InfoFooterCta
        text="Changed your mind about something?"
        href="/returns"
        label="Read the returns policy"
      />
    </InfoPage>
  );
}
