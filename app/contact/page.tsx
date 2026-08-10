import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { InfoSection } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Call, email or message Kandi UG — and where to go for order questions.",
};

export default async function ContactPage() {
  const { support } = await getSiteSettings();

  const channels = [
    {
      label: "Call us",
      value: support.phone,
      href: `tel:${support.phone.replace(/\s/g, "")}`,
      detail: support.hours,
      tone: "text-pop-green",
    },
    {
      label: "Email us",
      value: support.email,
      href: `mailto:${support.email}`,
      detail: "We reply within one working day",
      tone: "text-pop-blue",
    },
    ...(support.whatsapp
      ? [
          {
            label: "WhatsApp",
            value: "Start a chat",
            href: `https://wa.me/${support.whatsapp}`,
            detail: "Fastest for questions about a live order",
            tone: "text-pop-green",
          },
        ]
      : []),
  ];

  return (
    <InfoPage
      eyebrow="Contact"
      title="Contact us"
      intro="Questions about an order, a return or a product? Here is how to reach a person."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {channels.map((channel) => (
          <a
            key={channel.label}
            href={channel.href}
            target={channel.href.startsWith("http") ? "_blank" : undefined}
            rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="rounded-2xl border border-shop-line bg-white p-5 transition-colors hover:border-shop-primary"
          >
            <p className={`text-[13px] font-semibold uppercase tracking-wide ${channel.tone}`}>
              {channel.label}
            </p>
            <p className="mt-1.5 text-[19px] font-semibold text-shop-ink">{channel.value}</p>
            <p className="mt-1 text-[14px] text-shop-muted">{channel.detail}</p>
          </a>
        ))}
      </div>

      <ContactForm supportPhone={support.phone} />

      <InfoSection title="Where to go first">
        <ul>
          <li>
            <strong>&ldquo;Where is my order?&rdquo;</strong> — the live status of every order you
            have placed is on your <Link href="/account/orders">orders page</Link>.
          </li>
          <li>
            <strong>&ldquo;I want to return something.&rdquo;</strong> — read{" "}
            <Link href="/returns">returns &amp; refunds</Link> first; it covers most cases without
            needing to call.
          </li>
          <li>
            <strong>&ldquo;How long will delivery take?&rdquo;</strong> — see{" "}
            <Link href="/shipping">delivery information</Link>.
          </li>
          <li>
            <strong>Selling with us</strong> — the{" "}
            <Link href="/seller">Seller Centre</Link> has its own support channel inside the
            dashboard.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Visit us">
        <p>{support.address}</p>
        <p>{support.hours}</p>
      </InfoSection>
    </InfoPage>
  );
}
