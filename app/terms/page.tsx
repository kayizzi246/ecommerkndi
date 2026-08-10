import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { InfoSection } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description: "The terms you agree to when you shop with Kandi UG.",
};

export default async function TermsPage() {
  const { commerce, support, brand } = await getSiteSettings();

  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms & conditions"
      intro={`These terms apply whenever you buy from ${brand.name} UG. They are written to be readable — if anything is unclear, ask us before you order.`}
    >
      <InfoSection title="1. Who you are buying from">
        <p>
          Some products are sold by {brand.name} UG directly. Others are sold by independent
          stores through our marketplace — the seller is named on the product page. In both cases
          your order is placed with, and paid to, {brand.name} UG, and we handle delivery,
          returns and refunds.
        </p>
      </InfoSection>

      <InfoSection title="2. Prices and payment">
        <ul>
          <li>All prices are in Ugandan shillings and include any applicable tax.</li>
          <li>
            The delivery charge, if any, is shown at checkout before you pay. Nothing is added
            afterwards.
          </li>
          <li>
            You can pay on delivery in cash, by MTN Mobile Money or by Airtel Money, or by card at
            checkout.
          </li>
          <li>
            Prices can change, but never after you have placed an order — the price you saw is the
            price you pay.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="3. Your order">
        <p>
          An order is an offer to buy. It is accepted once we confirm it, and we may decline it if
          the item turns out to be out of stock, if the price was listed in error, or if we cannot
          deliver to the address given. If we decline an order you have already paid for, you get
          a full refund.
        </p>
      </InfoSection>

      <InfoSection title="4. Delivery">
        <p>
          Delivery is free on orders over {formatPrice(commerce.free_delivery_from)}. Timescales
          are set out on the <Link href="/shipping">delivery page</Link>. They are estimates: we
          depend on couriers, and we will tell you if something is running late.
        </p>
      </InfoSection>

      <InfoSection title="5. Returns and refunds">
        <p>
          You have {commerce.returns_days} days from delivery to change your mind, and longer
          rights than that if an item is faulty or not as described. The full policy is on the{" "}
          <Link href="/returns">returns page</Link> and forms part of these terms. Nothing here
          removes the rights Ugandan consumer law gives you.
        </p>
      </InfoSection>

      <InfoSection title="6. Your account">
        <p>
          You are responsible for what happens under your account. Sign-in is through Google, so
          keep that account secure. Tell us at once if you think someone else has used yours.
        </p>
      </InfoSection>

      <InfoSection title="7. Reviews you write">
        <p>
          Reviews must be your own honest experience of a product you bought. We remove reviews
          that are abusive, contain personal data, or are written to promote another business. We
          do not delete reviews for being negative.
        </p>
      </InfoSection>

      <InfoSection title="8. Selling on Kandi">
        <p>
          Sellers agree to the <Link href="/seller-policies">seller policies</Link> in addition to
          these terms.
        </p>
      </InfoSection>

      <InfoSection title="9. Contact">
        <p>
          {brand.name} UG, {support.address}. Phone{" "}
          <a href={`tel:${support.phone.replace(/\s/g, "")}`}>{support.phone}</a>, email{" "}
          <a href={`mailto:${support.email}`}>{support.email}</a>.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
