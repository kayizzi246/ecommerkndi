import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { InfoSection } from "@/components/InfoPage";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy policy",
  description: "What Kandi UG collects, why, and what you can ask us to delete.",
};

export default async function PrivacyPage() {
  const { support, brand } = await getSiteSettings();

  return (
    <InfoPage
      eyebrow="Legal"
      title="Privacy policy"
      intro="What we collect, why we collect it, and how to get it removed. In short: only what an order needs, and never sold to anyone."
    >
      <InfoSection title="What we collect">
        <ul>
          <li>
            <strong>To deliver an order</strong> — your name, phone number and delivery address.
          </li>
          <li>
            <strong>If you sign in</strong> — your name, email address and profile photo, passed
            to us by Google when you choose to sign in. We never see your Google password.
          </li>
          <li>
            <strong>What you do on the site</strong> — your cart, your wishlist and the products
            you have viewed recently. The wishlist and recently-viewed lists are stored in your own
            browser, not on our servers.
          </li>
          <li>
            <strong>Reviews you write</strong> — your rating, your words and the display name on
            your account, which are shown publicly on the product page.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="What we do not do">
        <ul>
          <li>We do not sell or rent your details to anyone.</li>
          <li>We do not store card numbers. Card payments are handled by the payment provider.</li>
          <li>We do not email you marketing you did not ask for.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Cookies and what your browser stores" id="cookies">
        <p>
          We use the minimum a shop can work with, and nothing else. There are{" "}
          <strong>no advertising cookies and no third-party trackers</strong> on this site — no
          Google Analytics, no Facebook pixel, nothing that follows you to another website.
        </p>
        <ul>
          <li>
            <strong>Sign-in cookie</strong> — set when you sign in, so you stay signed in. It is
            readable only by our server, never by scripts in your browser, and it expires by
            itself.
          </li>
          <li>
            <strong>Your basket, wishlist and recently viewed</strong> — kept in your own browser,
            not on our servers, so your cart survives closing the tab.
          </li>
          <li>
            <strong>Preferences</strong> — the departments you picked when you first arrived, and
            whether you have dismissed a notice like the cookie one.
          </li>
        </ul>
        <p>
          All of it is strictly necessary or set by you, which is why there is no consent form to
          fill in. Clearing your browser&apos;s site data removes every one of them, and the shop
          still works — you will just be signed out with an empty basket.
        </p>
      </InfoSection>

      <InfoSection title="Who else sees your data">
        <ul>
          <li>
            <strong>The courier</strong> — your name, phone number and address, so they can
            deliver.
          </li>
          <li>
            <strong>The seller</strong>, if the item came from a marketplace store — the same
            delivery details, and only for their part of the order.
          </li>
          <li>
            <strong>Google</strong>, if you use Google sign-in, under their own privacy policy.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="How long we keep it">
        <p>
          Order records are kept for as long as tax and accounting rules require. Account details
          are kept until you ask us to delete them. Anything stored in your browser — the cart,
          the wishlist, recently viewed — you can clear yourself at any time by clearing site
          data.
        </p>
      </InfoSection>

      <InfoSection title="Your choices">
        <p>
          You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to
          delete your account. Email{" "}
          <a href={`mailto:${support.email}`}>{support.email}</a> and we will action it within 30
          days. Deleting your account removes your profile and your reviews; the order records we
          are legally required to keep will remain.
        </p>
        <p>
          You can edit what you have shared with us at any time on your{" "}
          <Link href="/account/settings">account settings</Link> page.
        </p>
      </InfoSection>

      <InfoSection title="Contact">
        <p>
          Questions about privacy go to{" "}
          <a href={`mailto:${support.email}`}>{support.email}</a>, or write to {brand.name} UG,{" "}
          {support.address}.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
