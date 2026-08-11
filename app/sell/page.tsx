import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";
import EarningsCalculator from "./EarningsCalculator";

export const metadata: Metadata = {
  alternates: { canonical: "/sell" },
  title: "Sell on Kandi",
  description:
    "Open a store on Kandi and reach shoppers across Uganda. No listing fees, one flat commission, and payouts you request yourself.",
};

export default async function SellPage() {
  const settings = await getSiteSettings();
  const { seller, commerce, brand } = settings;

  const benefits = [
    {
      title: "No listing fees, ever",
      copy: `List as many products as you like. We only earn when you do — a flat ${seller.commission_rate}% of each item sold, and nothing else.`,
      tone: "text-pop-green",
      bg: "bg-pop-green-soft",
      icon: "M12 3v18M8 7h6.5a2.5 2.5 0 0 1 0 5H9.5a2.5 2.5 0 0 0 0 5H16",
    },
    {
      title: "Delivery is handled",
      copy: `We collect, deliver nationwide and carry the free-delivery promise over ${formatPrice(commerce.free_delivery_from)}. You pack the parcel; we do the rest.`,
      tone: "text-pop-blue",
      bg: "bg-pop-blue-soft",
      icon: "M3 6h2.2l2 10.5h11.1L20 9H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8.5 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    },
    {
      title: "You get paid on your say-so",
      copy: `Earnings clear once an order completes. Request a payout whenever you want it — settled every ${seller.payout_days} days to mobile money or your bank.`,
      tone: "text-pop-violet",
      bg: "bg-pop-violet-soft",
      icon: "M3 7h18v10H3V7Zm0 4h18M7 15h3",
    },
    {
      title: "Real numbers, not vanity charts",
      copy: "Revenue, units, best sellers, what is running out of stock and exactly what you are owed — updated as orders land.",
      tone: "text-pop-orange",
      bg: "bg-pop-orange-soft",
      icon: "M4 19V5m0 14h16M8 19v-6m4 6V9m4 10v-4",
    },
    {
      title: "Your brand stays yours",
      copy: "Your store gets its own page and its own name on every product you sell. Shoppers know who they are buying from.",
      tone: "text-pop-pink",
      bg: "bg-pop-red-soft",
      icon: "M4 5h6v6H4V5Zm10 0h6v6h-6V5ZM4 13h6v6H4v-6Zm10 0h6v6h-6v-6Z",
    },
    {
      title: "Payment risk is on us",
      copy: "Cash on delivery, MTN MoMo, Airtel Money and cards are all collected by Kandi. You are never chasing a customer for money.",
      tone: "text-pop-green",
      bg: "bg-pop-green-soft",
      icon: "M12 3 4 6v6c0 4.5 3.3 7.9 8 9 4.7-1.1 8-4.5 8-9V6l-8-3Zm-2 9 1.8 1.8L15 10",
    },
  ];

  const steps = [
    {
      title: "Apply",
      copy: "Five short steps: your store, you, your password, the joining fee, done. About three minutes.",
    },
    {
      title: "Pay the joining fee",
      copy: `A one-off ${formatPrice(seller.registration_fee)} by mobile money, quoting the reference we give you.`,
    },
    {
      title: "We check and approve",
      copy: "A person reviews every application. Usually same day, and we email you either way.",
    },
    {
      title: "List and sell",
      copy: "Add products from your dashboard. Each listing is checked once, then you are live.",
    },
  ];

  const feeCovers = [
    "Verifying your identity and your business, so shoppers can trust every store on the marketplace",
    "Setting up your store page, your seller account and your payout details",
    "The first review of your listings — photos, descriptions and pricing checked by a person",
    "Onboarding support: someone walks you through your first listing and your first payout",
  ];

  const faqs = [
    {
      q: "Is the joining fee refundable?",
      a: `If we reject your application, the ${formatPrice(seller.registration_fee)} is refunded in full within five working days. If you are approved and later close your store, it is not refunded — the work it pays for has already been done.`,
    },
    {
      q: "Are there any other charges?",
      a: `No. No listing fees, no monthly fee, no payout fee. The only ongoing cost is the ${seller.commission_rate}% commission on items you actually sell.`,
    },
    {
      q: "What can I sell?",
      a: "Footwear and fashion are our core, and that is where the shoppers are. Genuine products only, with your own photographs. Counterfeits close a store immediately.",
    },
    {
      q: "Who handles returns?",
      a: `Kandi does. Shoppers get ${commerce.returns_days} days, the same across the whole site. A returned item comes back to you and the commission on it is reversed automatically.`,
    },
    {
      q: "How quickly do I get my money?",
      a: `Earnings sit as pending while an order is being fulfilled, become payable once it completes, and you request a payout from your dashboard. We settle every ${seller.payout_days} days.`,
    },
  ];

  return (
    <main className="pb-24 lg:pb-16">
      {/* ---- Hero ---- */}
      <section className="border-b border-shop-line bg-gradient-to-b from-pop-green-soft to-white">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-14 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-pop-green shadow-sm">
              <span className="h-2 w-2 rounded-full bg-pop-green" aria-hidden />
              Now accepting new stores
            </span>

            <h1 className="mt-5 text-[34px] font-extrabold leading-[1.1] tracking-tight text-shop-ink md:text-[46px]">
              Sell your shoes and fashion to the whole of Uganda
            </h1>

            <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-shop-body">
              Open a store on {brand.name}, list what you have, and let us handle the storefront,
              the payments and the delivery. No listing fees — a flat {seller.commission_rate}%
              when something sells.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/seller/register" className="btn-shop px-8 py-3.5 text-[16px]">
                Get started
              </Link>
              <Link href="#calculator" className="btn-shop-outline px-7 py-3.5 text-[16px]">
                See what you would keep
              </Link>
            </div>

            <p className="mt-4 text-[14px] text-shop-muted">
              One-off {formatPrice(seller.registration_fee)} joining fee · refunded if we turn you
              down · already selling?{" "}
              <Link href="/seller/login" className="font-semibold text-shop-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <div id="calculator" className="scroll-mt-28">
            <EarningsCalculator
              commissionRate={seller.commission_rate}
              registrationFee={seller.registration_fee}
              payoutDays={seller.payout_days}
            />
          </div>
        </div>
      </section>

      {/* ---- Benefits ---- */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 md:px-8">
        <h2 className="text-center text-[26px] font-extrabold tracking-tight text-shop-ink md:text-[32px]">
          What you get
        </h2>
        <p className="mx-auto mt-3 max-w-[55ch] text-center text-[16px] leading-relaxed text-shop-muted">
          Everything a shop needs to trade online, without building any of it yourself.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-shop-line bg-white p-6 transition-shadow hover:shadow-md"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${benefit.bg} ${benefit.tone}`}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={benefit.icon} />
                </svg>
              </span>
              <h3 className="mt-4 text-[18px] font-extrabold text-shop-ink">{benefit.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-shop-body">{benefit.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="border-y border-shop-line bg-shop-hairline/50">
        <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-8">
          <h2 className="text-center text-[26px] font-extrabold tracking-tight text-shop-ink md:text-[32px]">
            How it works
          </h2>

          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-shop-primary text-[17px] font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-[17px] font-extrabold text-shop-ink">{step.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-shop-body">{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- The fee, explained ---- */}
      {seller.registration_fee > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 py-16 md:px-8">
          <div className="grid gap-10 rounded-2xl border border-shop-line bg-white p-7 md:p-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-shop-primary">
                Straight answer
              </p>
              <h2 className="mt-2 text-[26px] font-extrabold leading-tight text-shop-ink md:text-[30px]">
                What the {formatPrice(seller.registration_fee)} is for
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-shop-body">
                It is charged once, when you join, and never again. It is not a deposit and it is
                not commission in advance — it pays for the work of getting a store trading.
              </p>
              <p className="mt-3 text-[16px] leading-relaxed text-shop-body">
                It also does a second job: it is why every store here is real. A marketplace that
                is free to join fills up with accounts that list a counterfeit and vanish, and it
                is the honest sellers who pay for that in lost trust.
              </p>
            </div>

            <ul className="space-y-3">
              {feeCovers.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-xl border border-shop-line p-4 text-[15px] leading-relaxed text-shop-body"
                >
                  <svg
                    className="mt-0.5 h-5 w-5 shrink-0 text-pop-green"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
              <li className="rounded-xl bg-pop-green-soft p-4 text-[15px] font-semibold leading-relaxed text-pop-green">
                Turned down? You get the full {formatPrice(seller.registration_fee)} back within
                five working days.
              </li>
            </ul>
          </div>
        </section>
      )}

      {/* ---- FAQ ---- */}
      <section className="mx-auto max-w-[820px] px-4 pb-4 md:px-8">
        <h2 className="text-center text-[26px] font-extrabold tracking-tight text-shop-ink md:text-[32px]">
          Before you apply
        </h2>

        <div className="mt-8 divide-y divide-shop-hairline rounded-2xl border border-shop-line bg-white px-6">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-shop-ink">
                {faq.q}
                <span className="shrink-0 text-[20px] leading-none text-shop-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2.5 text-[15px] leading-relaxed text-shop-body">{faq.a}</p>
            </details>
          ))}
        </div>

        <p className="mt-6 text-center text-[15px] text-shop-muted">
          The full rules are in the{" "}
          <Link href="/seller-policies" className="font-semibold text-shop-primary hover:underline">
            seller policies
          </Link>
          .
        </p>
      </section>

      {/* ---- Closing CTA ---- */}
      <section className="mx-auto max-w-[1200px] px-4 pt-14 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-pop-green to-pop-blue px-7 py-9 text-white md:px-12">
          <div>
            <h2 className="text-[24px] font-extrabold leading-tight md:text-[30px]">
              Set your store up today
            </h2>
            <p className="mt-2 max-w-[46ch] text-[16px] text-white/90">
              Three minutes to apply. Most applications are reviewed the same day.
            </p>
          </div>
          <Link
            href="/seller/register"
            className="rounded-full bg-white px-9 py-3.5 text-[16px] font-semibold text-pop-green transition-opacity hover:opacity-90"
          >
            Get started ›
          </Link>
        </div>
      </section>
    </main>
  );
}
