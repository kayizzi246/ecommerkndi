import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { InfoSection, InfoFooterCta } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Seller policies",
  description: "The rules for selling on the Kandi UG marketplace.",
};

export default async function SellerPoliciesPage() {
  const { commerce, support, brand } = await getSiteSettings();

  return (
    <InfoPage
      eyebrow="Sell with us"
      title="Seller policies"
      intro={`The rules every store on the ${brand.name} marketplace agrees to. They exist so shoppers can trust any listing on the site, whoever is selling it.`}
    >
      <InfoSection title="Getting approved">
        <p>
          Anyone can <Link href="/sell">apply</Link>, but no store goes live
          automatically. We check who you are and what you intend to sell before approving the
          account. Until then you can set your store up but not publish.
        </p>
      </InfoSection>

      <InfoSection title="What you may list">
        <ul>
          <li>Genuine products you own and can dispatch within one working day.</li>
          <li>
            Your own photographs of the actual item — not a manufacturer render or a picture
            lifted from another site.
          </li>
          <li>
            An honest description: real sizes, real materials, real condition. Any flaw goes in
            the description.
          </li>
        </ul>
        <p>
          Counterfeits, recalled goods and anything illegal to sell in Uganda are removed and the
          store is closed. There is no second warning for counterfeits.
        </p>
      </InfoSection>

      <InfoSection title="Pricing">
        <ul>
          <li>You set your own prices.</li>
          <li>
            A &ldquo;was&rdquo; price must be a price the item was genuinely sold at recently.
            Inflating it to fake a discount is grounds for removal.
          </li>
          <li>
            Free delivery over {formatPrice(commerce.free_delivery_from)} is a storefront-wide
            promise. Do not price around it by inflating the item price.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Orders and dispatch">
        <ul>
          <li>Confirm and hand over an order within one working day of receiving it.</li>
          <li>
            Keep your stock levels current. Repeatedly cancelling orders for items that were not
            actually in stock will suspend your store.
          </li>
          <li>
            Returns follow the storefront{" "}
            <Link href="/returns">returns policy</Link> — {commerce.returns_days} days, and longer
            when the item is faulty. You cannot set a stricter policy than the storefront&rsquo;s.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Commission and payouts">
        <p>
          Commission is a percentage of each item sold, agreed with you when your store is
          approved and visible in your Seller Centre. It is deducted per line item, not per order.
        </p>
        <ul>
          <li>Earnings are <strong>pending</strong> while the order is being fulfilled.</li>
          <li>
            They become <strong>payable</strong> once the order is marked completed, which is
            after the returns window has passed.
          </li>
          <li>
            You request a payout from the Seller Centre; we settle to the mobile money number or
            bank account on your profile.
          </li>
          <li>Cancelled and refunded orders reverse the commission automatically.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Reviews">
        <p>
          Shoppers review products, not stores, and reviews are never edited or deleted for being
          negative. Asking a customer to change a review in exchange for anything is grounds for
          suspension.
        </p>
      </InfoSection>

      <InfoSection title="Suspension and closure">
        <p>
          We will always tell you what the problem is and give you a chance to fix it, except for
          counterfeits and illegal goods, which are immediate. You can close your store at any
          time; any payable earnings are settled in the next payout run. Questions go to{" "}
          <a href={`mailto:${support.email}`}>{support.email}</a>.
        </p>
      </InfoSection>

      <InfoFooterCta
        text="Ready to open your store?"
        href="/sell"
        label="Become a seller"
      />
    </InfoPage>
  );
}
