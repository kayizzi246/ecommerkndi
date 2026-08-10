import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { InfoSection, InfoFooterCta } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";

export const metadata: Metadata = {
  title: "About us",
  description:
    "Kandi UG is a modern Ugandan e-commerce brand focused on making fashion shopping simple, convenient and accessible.",
};

export default async function AboutPage() {
  const settings = await getSiteSettings();

  return (
    <InfoPage
      eyebrow="About us"
      title="About Kandi UG"
      intro="Kandi UG is a modern Ugandan e-commerce brand focused on making fashion shopping simple, convenient, and accessible."
    >
      <InfoSection title="What we do">
        <p>
          We offer a carefully selected range of stylish footwear and fashion products, giving
          customers an easy way to discover and shop for quality products online. Rather than
          stocking everything, we curate — every listing is chosen because it is something we
          would wear ourselves.
        </p>
      </InfoSection>

      <InfoSection title="How we shop differently">
        <ul>
          <li>
            <strong>Simple.</strong> A clear price, a clear size, and a picture of the actual
            product. No hidden fees added at the last step.
          </li>
          <li>
            <strong>Convenient.</strong> Pay on delivery with cash, MTN Mobile Money or Airtel
            Money, or by card at checkout — whichever suits you.
          </li>
          <li>
            <strong>Accessible.</strong> Free delivery on orders over{" "}
            {formatPrice(settings.commerce.free_delivery_from)}, nationwide, with{" "}
            {settings.commerce.returns_days} days to change your mind.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="A marketplace, not just a shop">
        <p>
          Alongside our own range, independent Ugandan stores sell through Kandi. They keep their
          own brand and set their own prices; we handle the storefront, the payments and the
          delivery promise. You can{" "}
          <Link href="/sellers">browse the stores selling with us</Link>, or{" "}
          <Link href="/sell">open your own</Link>.
        </p>
      </InfoSection>

      <InfoSection title="Talk to us">
        <p>
          We are a small team and we read everything. Call{" "}
          <a href={`tel:${settings.support.phone.replace(/\s/g, "")}`}>{settings.support.phone}</a>{" "}
          or email <a href={`mailto:${settings.support.email}`}>{settings.support.email}</a>.
          We are open {settings.support.hours.toLowerCase()}, and we are based in{" "}
          {settings.support.address}.
        </p>
      </InfoSection>

      <InfoFooterCta
        text="Ready to find something you like?"
        href="/"
        label="Start shopping"
      />
    </InfoPage>
  );
}
