import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import { getStores } from "@/lib/woocommerce";
import { formatPrice } from "@/lib/currency";
import EarningsCalculator from "./EarningsCalculator";

export const metadata: Metadata = {
  alternates: { canonical: "/sell" },
  title: "Sell on Kandi",
  description:
    "Open a store on Kandi and sell to shoppers across Uganda. We take the payments and deliver the orders. No listing fees.",
};

/**
 * /sell, the page that turns a shop owner into a seller.
 *
 * Built to be skimmed on a phone: one promise in the headline, the costs in
 * plain numbers, a calculator that shows what is left after every charge, and
 * the button repeated where a reader decides (hero, after pricing, the foot,
 * and a bar pinned to the bottom of a phone). Proof is real: the store count
 * comes from the live directory and is only shown once it is worth showing.
 */
export default async function SellPage() {
  const [settings, stores] = await Promise.all([
    getSiteSettings(),
    getStores().catch(() => []),
  ]);
  const { seller, commerce, brand, support } = settings;
  const fee = seller.registration_fee;
  const rate = seller.commission_rate;
  const storeCount = stores.length;
  const productCount = stores.reduce((sum, store) => sum + store.product_count, 0);

  const whatsappDigits = whatsappNumber(support.whatsapp);
  const contactHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Hello, I want to sell on ${brand.name}.`)}`
    : support.phone
      ? `tel:${support.phone.replace(/\s+/g, "")}`
      : "/contact";
  const contactLabel = whatsappDigits ? "Ask us on WhatsApp" : support.phone ? `Call ${support.phone}` : "Talk to us";

  const weDo = [
    { title: "Your shop online", copy: "Your own store page and your name on every product." },
    {
      title: "Payments",
      copy: "MTN MoMo, Airtel Money, cards and cash on delivery. We collect, so you never chase a customer.",
    },
    { title: "Delivery", copy: "Our riders pick up from you and deliver across Uganda." },
    { title: "Customers", copy: `Support calls, questions and ${commerce.returns_days}-day returns.` },
  ];

  const youDo = [
    { title: "List your products", copy: "Photos, price and stock, from your phone." },
    { title: "Pack the order", copy: "We tell you the moment something sells." },
  ];

  const steps = [
    { title: "Apply", copy: "Takes about 3 minutes." },
    { title: "Get approved", copy: "A person reviews your store, usually the same day." },
    { title: "Sell and get paid", copy: `List products and withdraw every ${seller.payout_days} days.` },
  ];

  const faqs = [
    {
      q: "What does it cost?",
      a:
        fee > 0
          ? `${formatPrice(fee)} a month and ${rate}% of each item you sell. No listing fees, no payout fees, nothing else.`
          : `${rate}% of each item you sell. No listing fees, no payout fees, nothing else.`,
    },
    ...(fee > 0
      ? [
          {
            q: "What if I am not approved?",
            a: `Your first ${formatPrice(fee)} is refunded in full within five working days.`,
          },
          {
            q: "Can I stop paying?",
            a: "Yes, any time. Your products stop showing when the month ends, and your account, products and order history are kept. Pay again and everything comes back.",
          },
        ]
      : []),
    {
      q: "What can I sell?",
      a: "Genuine shoes, clothes, bags and accessories, photographed by you. Copies are not allowed and close a store.",
    },
    {
      q: "How do I get paid?",
      a: `Once an order is delivered the money is yours. Request a payout from your dashboard and it is sent to mobile money or your bank every ${seller.payout_days} days.`,
    },
    {
      q: "Who handles returns?",
      a: `We do. Shoppers get ${commerce.returns_days} days. A returned item comes back to you and our commission on it is cancelled.`,
    },
  ];

  return (
    <main className="bg-white pb-20 md:pb-0">
      {/* ================= Hero ================= */}
      {/* Black, heavy and loud: the one page on the site that is selling a
          business rather than a product. The yellow is the shop's own. */}
      <section className="relative overflow-hidden bg-[#0d0d0d] text-white">
        {/* A single soft yellow glow behind the calculator; decoration kept to one. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-shop-primary/20 blur-[120px]"
        />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-12 md:px-8 md:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-shop-primary">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-shop-primary" />
              {brand.name} for sellers
            </p>
            <h1 className="mt-5 text-[38px] font-black leading-[1.02] tracking-[-0.035em] md:text-[52px] lg:text-[60px]">
              Sell to <span className="text-shop-primary">all of Uganda.</span>
              <br />
              We do the rest.
            </h1>
            <p className="mt-5 max-w-[44ch] text-[16px] leading-[1.6] text-white/70 md:text-[17px]">
              Open your store today. We take the payments and deliver every order. You list your
              shoes and clothes, and pack.
            </p>

            {/* The offer as three big figures rather than a ticked list. */}
            <dl className="mt-8 grid max-w-[520px] grid-cols-3 gap-3">
              {[
                { value: "0", label: "listing fees" },
                { value: `${rate}%`, label: "only when you sell" },
                { value: `${seller.payout_days} days`, label: "to your mobile money" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                  <dt className="sr-only">{item.label}</dt>
                  <dd className="text-[24px] font-black leading-none tracking-[-0.02em] text-white md:text-[28px]">
                    {item.value}
                  </dd>
                  <dd className="mt-1.5 text-[12px] leading-snug text-white/60">{item.label}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/seller/register"
                className="inline-flex items-center gap-2 rounded-full bg-shop-primary px-7 py-3.5 text-[15px] font-bold text-shop-ink transition-colors hover:bg-shop-primary-dark"
              >
                Open your store
                <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4Z" />
                </svg>
              </Link>
              <a
                href={contactHref}
                target={whatsappDigits ? "_blank" : undefined}
                rel={whatsappDigits ? "noopener noreferrer" : undefined}
                className="inline-flex items-center rounded-full border border-white/25 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:border-white"
              >
                {contactLabel}
              </a>
            </div>

            <p className="mt-6 text-[13px] text-white/55">
              {storeCount >= 5 && (
                <>
                  <strong className="text-white">{storeCount} stores</strong>
                  {productCount > 0 && (
                    <>
                      {" "}and <strong className="text-white">{productCount.toLocaleString("en-UG")} products</strong>
                    </>
                  )}{" "}
                  already on {brand.name} ·{" "}
                </>
              )}
              Already selling?{" "}
              <Link href="/seller/login" className="font-semibold text-white underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>

          <div id="calculator" className="scroll-mt-24">
            <EarningsCalculator commissionRate={rate} registrationFee={fee} />
          </div>
        </div>
      </section>

      {/* ================= Who does what ================= */}
      <section className="border-b border-shop-line">
        <div className="mx-auto max-w-[1200px] px-4 py-12 md:px-8 md:py-16">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-shop-ink md:text-[26px]">
            We run the shop. You sell.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-[2fr_1fr]">
            <div className="rounded-xl bg-shop-band p-5 text-white md:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-shop-primary">
                {brand.name} does
              </p>
              <ul className="mt-4 grid gap-5 sm:grid-cols-2">
                {weDo.map((item) => (
                  <li key={item.title}>
                    <p className="text-[15px] font-semibold">{item.title}</p>
                    <p className="mt-1 text-[13px] leading-[1.55] text-white/70">{item.copy}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-shop-line p-5 md:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-shop-muted">
                You do
              </p>
              <ul className="mt-4 space-y-5">
                {youDo.map((item) => (
                  <li key={item.title}>
                    <p className="text-[15px] font-semibold text-shop-ink">{item.title}</p>
                    <p className="mt-1 text-[13px] leading-[1.55] text-shop-body">{item.copy}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Steps ================= */}
      <section className="border-b border-shop-line bg-[#faf9f6]">
        <div className="mx-auto max-w-[1200px] px-4 py-12 md:px-8 md:py-16">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-shop-ink md:text-[26px]">
            Start selling in 3 steps
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shop-primary text-[15px] font-bold text-shop-ink">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[16px] font-semibold text-shop-ink">{step.title}</p>
                  <p className="mt-1 text-[14px] leading-[1.55] text-shop-body">{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= Pricing ================= */}
      <section id="pricing" className="scroll-mt-20 border-b border-shop-line">
        <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-4 py-12 md:px-8 md:py-16 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2 className="text-[22px] font-bold tracking-[-0.02em] text-shop-ink md:text-[26px]">
              One simple price
            </h2>
            <p className="mt-3 max-w-[44ch] text-[15px] leading-[1.6] text-shop-body">
              No setup costs, no listing fees and no payout fees.
              {fee > 0 && " Stop whenever you like."}
            </p>
          </div>

          <div className="rounded-2xl border-2 border-shop-ink p-6 md:p-7">
            <p className="flex flex-wrap items-baseline gap-x-2 text-shop-ink">
              {fee > 0 && (
                <>
                  <span className="text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums">
                    {formatPrice(fee)}
                  </span>
                  <span className="text-[15px] text-shop-muted">a month</span>
                  <span className="text-[20px] font-semibold text-shop-muted">+</span>
                </>
              )}
              <span className="text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums">
                {rate}%
              </span>
              <span className="text-[15px] text-shop-muted">per item sold</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-[14px] text-shop-ink">
              <Check>Your own store page</Check>
              <Check>Unlimited products</Check>
              <Check>Payments and delivery handled</Check>
              <Check>Sales dashboard and order alerts</Check>
              <Check>A person to help you list your first products</Check>
            </ul>
            <Link href="/seller/register" className="btn-shop mt-7 w-full py-3.5 text-[15px]">
              Open your store
            </Link>
            {fee > 0 && (
              <p className="mt-3 text-center text-[13px] text-shop-muted">
                Not approved? Your first month is refunded.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-20 border-b border-shop-line bg-[#faf9f6]">
        <div className="mx-auto max-w-[820px] px-4 py-12 md:px-8 md:py-16">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-shop-ink md:text-[26px]">
            Questions
          </h2>
          <div className="mt-6 divide-y divide-shop-line border-y border-shop-line">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[15px] font-semibold text-shop-ink">
                  {faq.q}
                  <span
                    aria-hidden
                    className="shrink-0 text-[20px] font-normal leading-none text-shop-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2.5 text-[14px] leading-[1.65] text-shop-body">{faq.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-5 text-[13px] text-shop-muted">
            Full rules:{" "}
            <Link href="/seller-policies" className="font-semibold text-shop-ink underline underline-offset-4">
              seller policies
            </Link>
          </p>
        </div>
      </section>

      {/* ================= Closing ================= */}
      <section className="bg-shop-band">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between md:px-8 md:py-14">
          <div>
            <h2 className="text-[24px] font-bold tracking-[-0.02em] text-white md:text-[28px]">
              Your next customer is already shopping
            </h2>
            <p className="mt-2 text-[14px] text-white/70">Apply in 3 minutes. Most applications are reviewed the same day.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/seller/register" className="btn-shop px-7 py-3.5 text-[15px]">
              Open your store
            </Link>
            <a
              href={contactHref}
              target={whatsappDigits ? "_blank" : undefined}
              rel={whatsappDigits ? "noopener noreferrer" : undefined}
              className="inline-flex items-center rounded-lg border border-white/30 px-6 py-3.5 text-[15px] font-semibold text-white hover:border-white"
            >
              {contactLabel}
            </a>
          </div>
        </div>
      </section>

      {/* The button stays in reach on a phone, wherever the reader is. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-shop-line bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
        <Link href="/seller/register" className="btn-shop w-full py-3.5 text-[15px]">
          Open your store
        </Link>
      </div>
    </main>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="mt-0.5 h-[18px] w-[18px] shrink-0 text-shop-save"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

/** A wa.me-ready number (256…), or "" when the shop has none. */
function whatsappNumber(raw: string | undefined): string {
  let digits = (raw ?? "").replace(/[^\d]/g, "");
  if (digits.startsWith("0")) digits = `256${digits.slice(1)}`;
  return digits;
}
