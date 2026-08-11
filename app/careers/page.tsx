import type { Metadata } from "next";
import InfoPage, { InfoSection, InfoFooterCta } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  alternates: { canonical: "/careers" },
  title: "Careers",
  description: "Work with Kandi UG — what we look for and how to apply.",
};

export default async function CareersPage() {
  const { support, brand } = await getSiteSettings();

  const areas = [
    {
      title: "Warehouse & fulfilment",
      copy: "Picking, packing and quality-checking every order before it leaves us.",
      tone: "text-pop-green",
    },
    {
      title: "Customer service",
      copy: "Answering the phone, chasing couriers and sorting returns quickly.",
      tone: "text-pop-blue",
    },
    {
      title: "Buying & merchandising",
      copy: "Choosing what we stock and keeping the sizes people actually want in stock.",
      tone: "text-pop-violet",
    },
    {
      title: "Content & photography",
      copy: "Shooting products honestly, so what arrives looks like what was on screen.",
      tone: "text-pop-orange",
    },
  ];

  return (
    <InfoPage
      eyebrow="Careers"
      title={`Work with ${brand.name}`}
      intro="We are a small Ugandan team building a shop we would want to buy from. We hire for care and common sense more than for CVs."
    >
      <InfoSection title="Where we usually need people">
        <div className="grid gap-4 sm:grid-cols-2">
          {areas.map((area) => (
            <div key={area.title} className="rounded-2xl border border-shop-line bg-white p-5">
              <p className={`text-[16px] font-semibold ${area.tone}`}>{area.title}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-shop-muted">{area.copy}</p>
            </div>
          ))}
        </div>
      </InfoSection>

      <InfoSection title="What we look for">
        <ul>
          <li>You do what you said you would do, when you said you would do it.</li>
          <li>You would rather tell a customer the awkward truth than an easy story.</li>
          <li>You notice the small things — a wrong size, a scuffed box, a slow reply.</li>
        </ul>
      </InfoSection>

      <InfoSection title="How to apply">
        <p>
          We do not always have a role open, but we always read applications. Email{" "}
          <a href={`mailto:${support.email}`}>{support.email}</a> with the subject line
          &ldquo;Careers&rdquo;, tell us what you would like to do and why, and attach a CV if you
          have one. If you do not have a CV, a short message is fine — tell us what you have done
          before.
        </p>
      </InfoSection>

      <InfoFooterCta
        text="Would you rather sell your own products through us?"
        href="/sell"
        label="Become a seller"
      />
    </InfoPage>
  );
}
