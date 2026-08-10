import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { InfoSection, InfoFooterCta } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Returns & refunds",
  description: "How to return an item to Kandi UG and how refunds are paid.",
};

export default async function ReturnsPage() {
  const { commerce, support } = await getSiteSettings();
  const days = commerce.returns_days;

  return (
    <InfoPage
      eyebrow="Customer service"
      title="Returns & refunds"
      intro={`You have ${days} days from delivery to change your mind. If the item is faulty or wrong, the return is free and we cover the courier.`}
    >
      <InfoSection title="What can be returned">
        <ul>
          <li>
            Anything unworn and in its original condition, with tags still attached and the
            original box or packaging.
          </li>
          <li>Anything faulty, damaged in transit, or not what you ordered — always.</li>
          <li>
            For hygiene reasons, underwear, swimwear and pierced jewellery cannot be returned
            unless they are faulty.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="How to return something">
        <ul>
          <li>
            Open your <Link href="/account/orders">orders page</Link> and find the order.
          </li>
          <li>
            Call <a href={`tel:${support.phone.replace(/\s/g, "")}`}>{support.phone}</a> or email{" "}
            <a href={`mailto:${support.email}`}>{support.email}</a> with the order number and what
            is wrong. A photo helps if the item is damaged.
          </li>
          <li>
            We arrange the collection. Keep the item in its packaging until the courier comes.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="When you get your money back">
        <p>
          Once the item reaches us and passes a quick check, the refund is issued within 3 to 5
          working days, to the way you paid:
        </p>
        <ul>
          <li>
            <strong>Mobile money</strong> — back to the number that paid.
          </li>
          <li>
            <strong>Card</strong> — back to the card, which can take a further few days to appear
            on your statement, depending on your bank.
          </li>
          <li>
            <strong>Cash on delivery</strong> — by mobile money to the number on the order, unless
            you tell us otherwise.
          </li>
        </ul>
        <p>
          Delivery charges are refunded too when the item was faulty, damaged or not what you
          ordered.
        </p>
      </InfoSection>

      <InfoSection title="Exchanges">
        <p>
          For a different size or colour, the quickest route is a return plus a fresh order — that
          way your size is reserved immediately rather than waiting for the return to land.
        </p>
      </InfoSection>

      <InfoFooterCta
        text="Need to start a return?"
        href="/contact"
        label="Contact us"
      />
    </InfoPage>
  );
}
