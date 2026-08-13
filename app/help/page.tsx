import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { InfoSection } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";
import { faqJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/help" },
  title: "Help centre",
  description: "Answers to the questions Kandi UG shoppers ask most.",
};

export default async function HelpPage() {
  const { commerce, support } = await getSiteSettings();

  const topics = [
    { title: "Delivery", copy: "Times, costs and coverage", href: "/shipping", tone: "text-pop-green" },
    { title: "Returns & refunds", copy: `${commerce.returns_days} days to change your mind`, href: "/returns", tone: "text-pop-blue" },
    { title: "Track an order", copy: "See where your parcel is", href: "/track-order", tone: "text-pop-violet" },
    { title: "Contact a person", copy: "Phone, email and WhatsApp", href: "/contact", tone: "text-pop-orange" },
  ];

  const faqs = [
    {
      q: "Do I have to pay before delivery?",
      a: "No. You can pay the courier in cash, by MTN Mobile Money or by Airtel Money when the parcel arrives. Paying by card at checkout is also an option if you prefer.",
    },
    {
      q: "How do I know the size will fit?",
      a: "Every product page has a size guide with chest and waist measurements, and sizes follow the brand's own chart. If you are between sizes, go one size up.",
    },
    {
      q: "Can I change or cancel an order?",
      a: "Yes, as long as it has not been dispatched. Call us with the order number and we will stop it. After dispatch, refuse the delivery or return it once it arrives.",
    },
    {
      q: "Are the brands genuine?",
      a: "Yes. Every listing is checked before it goes live, and marketplace sellers are approved individually before they can publish anything.",
    },
    {
      q: "Do I need an account to order?",
      a: "No, you can check out as a guest. Signing in with Google lets you track orders, keep a wishlist, review what you have bought and check out faster next time.",
    },
    {
      q: "How do I leave a review?",
      a: "Sign in, open the product page and scroll to the reviews. You can rate anything you have bought, and edit your review later from your account.",
    },
  ];

  return (
    <InfoPage
      eyebrow="Customer service"
      title="Help centre"
      intro="The questions we get asked most, and where to go for everything else."
    >
      {/* The same `faqs` array the page renders below, marked up for Google.
          One source, so the expandable questions under the search result can
          never quote an answer this page no longer gives. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {topics.map((topic) => (
          <Link
            key={topic.title}
            href={topic.href}
            className="rounded-2xl border border-shop-line bg-white p-5 transition-colors hover:border-shop-primary"
          >
            <p className={`text-[17px] font-semibold ${topic.tone}`}>{topic.title}</p>
            <p className="mt-1 text-[14px] text-shop-muted">{topic.copy}</p>
          </Link>
        ))}
      </div>

      <InfoSection title="Frequently asked">
        <div className="divide-y divide-shop-hairline">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-shop-ink">
                {faq.q}
                <span className="shrink-0 text-shop-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-[15px] leading-relaxed text-shop-body">{faq.a}</p>
            </details>
          ))}
        </div>
      </InfoSection>

      <InfoSection title="Still stuck?">
        <p>
          Call <a href={`tel:${support.phone.replace(/\s/g, "")}`}>{support.phone}</a> or email{" "}
          <a href={`mailto:${support.email}`}>{support.email}</a>. We are open{" "}
          {support.hours.toLowerCase()}. Free delivery applies on orders over{" "}
          {formatPrice(commerce.free_delivery_from)}.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
