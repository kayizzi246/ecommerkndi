"use client";

import Link from "next/link";
import { useSellerSession } from "@/lib/seller-session";

/**
 * How selling on Kandi works, start to finish.
 *
 * Written for somebody who has never sold online — a trader with a shop in an
 * arcade and a phone full of product photos — so it says what to press and what
 * happens next, in the order it happens, rather than describing features.
 *
 * The figures a seller would want to check (their commission rate, their payout
 * account) are read from their own account, not written into the copy, so this
 * page cannot end up quoting terms that do not apply to them.
 */
export default function SellerGuidePage() {
  const { seller } = useSellerSession();
  const commission = seller?.commission_rate ?? 0;

  return (
    <div className="mx-auto max-w-[860px]">
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-shop-primary">
          New here?
        </p>
        <h1 className="mt-1.5 text-[28px] font-extrabold leading-tight text-shop-ink">
          How selling on Kandi works
        </h1>
        <p className="mt-2 max-w-[60ch] text-[16px] leading-relaxed text-shop-body">
          Ten minutes of reading, and you will know everything the job needs. Nothing here is
          theory — it is what happens, in the order it happens.
        </p>
      </header>

      <nav className="mt-7 rounded-2xl border border-shop-line bg-white p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-shop-muted">
          On this page
        </p>
        <ol className="mt-3 grid gap-2 text-[15px] sm:grid-cols-2">
          {SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="font-semibold text-shop-primary hover:underline"
              >
                {index + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-8 space-y-8">
        <Section id="setup" title="1. Getting your store open">
          <Steps
            items={[
              "Confirm your email. We send a six-digit code the moment you sign up — enter it and your account is live.",
              "Send your documents: a photo of your national ID, and whether the business is formally registered. If it is, we ask for the certificate or TIN number. Nobody but our team sees any of this, and none of it appears on your store page.",
              "Pay your monthly seller fee, by MTN MoMo, Airtel Money or card. Charged every month you trade.",
              "We check the documents — usually the same working day — and approve the store. You get an email when we do.",
            ]}
          />
          <Callout>
            You can add products while you wait for approval. They stay hidden until the store is
            approved, then go live together.
          </Callout>
        </Section>

        <Section id="listing" title="2. Adding a product">
          <Steps
            items={[
              "Products → New listing. The form is one screen.",
              "Photograph the actual item — not the supplier's picture. Daylight, plain wall or floor, no clutter. Four or five angles beats one perfect shot.",
              "Name it the way a shopper would search for it: what it is, the brand, the colour. Not ninety words of keywords.",
              "Set the price you want, and a sale price only if the higher price is genuinely what you were charging.",
              "Enter the stock you actually hold. Overselling and then cancelling is the fastest way to lose your rating.",
              "Submit. Our team clears new listings, then it appears on the shop.",
            ]}
          />
          <Callout tone="warning">
            Counterfeits close a store immediately, with no warning and no refund of the joining
            fee. If it is branded, it must be genuine.
          </Callout>
        </Section>

        <Section id="orders" title="3. When an order comes in">
          <Steps
            items={[
              "You get an email the moment a shopper buys — with the items, the delivery address and what you will be paid.",
              "Open Orders and press Accept order. That tells the buyer their order is confirmed and being packed, so do it only when you have the stock in your hand.",
              "Pack it properly. The rider collects from you, or you drop it at the agreed point.",
              "The order is marked complete once it is delivered, and your earnings clear for payout.",
            ]}
          />
          <Callout>
            If you cannot fulfil an order, say so the same day — call us rather than leaving it
            unaccepted. A late cancellation costs the shopper a wasted wait and costs you a rating.
          </Callout>
        </Section>

        <Section id="money" title="4. Getting paid">
          <Steps
            items={[
              `Kandi keeps ${commission > 0 ? `${commission}%` : "a commission"} of each completed order. There are no listing fees and no monthly fees — if nothing sells, you pay nothing.`,
              "Earnings clear once an order is completed, not when it is placed. Earnings shows the difference between pending and payable at a glance.",
              "Request a payout whenever you have cleared earnings. It goes to the mobile money number on your Settings page — check that number is right before you ask.",
              "We settle payout requests weekly, and email you when the money goes out.",
            ]}
          />
          <p className="text-[15px] leading-relaxed text-shop-body">
            Your own rate and payout account are on{" "}
            <Link href="/seller/settings" className="font-semibold text-shop-primary hover:underline">
              Settings
            </Link>
            , and every order&apos;s split is itemised in{" "}
            <Link href="/seller/commissions" className="font-semibold text-shop-primary hover:underline">
              Earnings
            </Link>
            .
          </p>
        </Section>

        <Section id="selling-more" title="5. Selling more">
          <Steps
            items={[
              "Photographs sell the product. The stores that do well here have their own clear pictures on a plain background — that alone outperforms a lower price with a bad photo.",
              "Keep stock numbers honest and current. Out-of-stock listings still show but cannot be bought, and they drag the whole store down.",
              "Answer quickly. Accepting an order within the hour is the single biggest thing you control.",
              "Price against what is already on the shop, not against your cost. Shoppers compare within a category before they buy.",
            ]}
          />
        </Section>

        <Section id="rules" title="6. What closes a store">
          <ul className="space-y-2 text-[15px] leading-relaxed text-shop-body">
            {[
              "Counterfeit or illegal goods — immediate, no warning.",
              "Taking payment outside Kandi, or asking a shopper to pay you directly.",
              "Repeatedly accepting orders you cannot fulfil.",
              "Photographs that are not of the item being sold.",
            ].map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pop-red" />
                {rule}
              </li>
            ))}
          </ul>
          <p className="text-[15px] leading-relaxed text-shop-body">
            The full terms are in the{" "}
            <Link href="/seller-policies" className="font-semibold text-shop-primary hover:underline">
              seller policies
            </Link>
            .
          </p>
        </Section>
      </div>

      <div className="mt-10 rounded-2xl border border-shop-line bg-white p-6 text-center">
        <h2 className="text-[19px] font-extrabold text-shop-ink">Still stuck?</h2>
        <p className="mx-auto mt-1.5 max-w-[46ch] text-[15px] leading-relaxed text-shop-body">
          Call the number in your approval email, or reply to any email we have sent you. A person
          reads it.
        </p>
        <Link href="/seller/products/new" className="btn-shop mt-5 inline-flex px-7 py-3 text-[15px]">
          Add your first product
        </Link>
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: "setup", title: "Getting your store open" },
  { id: "listing", title: "Adding a product" },
  { id: "orders", title: "When an order comes in" },
  { id: "money", title: "Getting paid" },
  { id: "selling-more", title: "Selling more" },
  { id: "rules", title: "What closes a store" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-shop-line bg-white p-5 md:p-6">
      <h2 className="text-[20px] font-extrabold leading-tight text-shop-ink">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Numbered directions. Numbered because the order matters in every section. */
function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3.5">
          <span
            aria-hidden
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-shop-hairline text-[13px] font-bold text-shop-ink"
          >
            {index + 1}
          </span>
          <p className="text-[15px] leading-relaxed text-shop-body">{item}</p>
        </li>
      ))}
    </ol>
  );
}

function Callout({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning";
}) {
  return (
    <p
      className={`rounded-xl px-4 py-3 text-[14.5px] leading-relaxed ${
        tone === "warning"
          ? "bg-pop-red-soft text-pop-red"
          : "bg-shop-primary-soft text-shop-primary-ink"
      }`}
    >
      {children}
    </p>
  );
}
