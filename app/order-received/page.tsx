import Link from "next/link";
import { formatPrice } from "@/lib/currency";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata = {
  title: "Order confirmed",
  // One shopper's confirmation, keyed to their order id. Nothing here belongs
  // in a search result, and a crawler following an order URL out of a shared
  // link should not keep it either.
  robots: { index: false, follow: false },
};

/**
 * The last screen of the shop, and the one that decides whether somebody feels
 * they have bought something or feels they have submitted a form.
 *
 * ---- What this replaced ----
 *
 * A page still drawn in the pre-redesign palette — `bfl-line`, `bfl-yellow`,
 * `bfl-grey` — so the final step of the checkout was the one screen that did
 * not look like the shop the order was placed in. It also said "Order received",
 * which is what a form says, and buried the two things a shopper actually wants
 * at that moment in a paragraph: what happens next, and how to check on it.
 *
 * ---- The `paid` flag ----
 *
 * Cash on delivery and a completed Pesapal payment need different sentences —
 * "have the money ready for the rider" is wrong and slightly alarming for
 * somebody who has just paid by card. The checkout passes it; absent, this
 * assumes cash on delivery, which is the commoner case here and the safer one
 * to state, since telling a payer they will pay later is a smaller error than
 * telling a cash buyer they are already settled.
 */
export default async function OrderReceivedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; total?: string; paid?: string; phone?: string }>;
}) {
  const { id, total, paid, phone } = await searchParams;
  const { support } = await getSiteSettings();

  const isPaid = paid === "1";
  const amount = total && Number(total) > 0 ? Number(total) : null;

  /* Prefilled, so the button below is one tap rather than a form. The tracking
     page matches on the last nine digits, so whichever way the number was
     typed at checkout it will find the order. */
  const trackHref =
    id && phone
      ? `/track-order?order=${encodeURIComponent(id)}&phone=${encodeURIComponent(phone)}`
      : id
        ? `/track-order?order=${encodeURIComponent(id)}`
        : "/track-order";

  const steps = [
    {
      title: "We call to confirm",
      body: "Usually within a couple of hours, on the number you gave us. Please pick up — an order we cannot confirm does not get packed.",
    },
    {
      title: "The seller packs it",
      body: "You will get an email the moment it is confirmed and again when it leaves for you.",
    },
    {
      title: isPaid ? "The rider delivers it" : "You pay the rider",
      body: isPaid
        ? "Delivery is usually 1–3 days in Kampala. Nothing more to pay."
        : "Cash, MTN MoMo or Airtel Money when it reaches you. Please have the exact amount ready.",
    },
  ];

  return (
    <main className="mx-auto max-w-xl px-4 py-10 md:py-16">
      {/* The tick, drawn large and in the shop's success green rather than the
          old yellow. Yellow reads as a warning at this size, which is the one
          thing this screen must not do. */}
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-shop-successbg">
          <svg
            className="h-9 w-9 text-shop-success"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </span>

        <h1 className="mt-5 text-[24px] font-extrabold text-shop-ink md:text-[28px]">
          Order confirmed
        </h1>
        <p className="mt-2 text-[15px] text-shop-muted">
          {isPaid
            ? "Payment received. We are getting it ready."
            : "Thank you — we have your order and are getting it ready."}
        </p>
      </div>

      {/* Number and total, boxed. This is the fact people screenshot. */}
      {id && (
        <div className="mt-7 rounded-2xl border border-shop-line bg-white p-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[14px] text-shop-muted">Order number</span>
            <span className="text-[17px] font-semibold text-shop-ink">#{id}</span>
          </div>
          {amount !== null && (
            <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-shop-line pt-3">
              <span className="text-[14px] text-shop-muted">
                {isPaid ? "Paid" : "To pay on delivery"}
              </span>
              <span className="text-[17px] font-semibold text-shop-ink">{formatPrice(amount)}</span>
            </div>
          )}
        </div>
      )}

      {/* What happens next, as three steps rather than a paragraph. A shopper
          who has just parted with money is scanning, not reading. */}
      <section className="mt-6 rounded-2xl border border-shop-line bg-white p-5">
        <h2 className="text-[15px] font-semibold text-shop-ink">What happens next</h2>
        <ol className="mt-3.5 space-y-4">
          {steps.map((entry, index) => (
            <li key={entry.title} className="flex gap-3.5">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-shop-surface text-[12px] font-bold text-shop-body"
              >
                {index + 1}
              </span>
              <div>
                <p className="text-[14px] font-semibold text-shop-ink">{entry.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-shop-muted">{entry.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href={trackHref} className="btn-shop flex-1 py-3.5 text-center text-[15px]">
          Track this order
        </Link>
        <Link
          href="/"
          className="flex-1 rounded-[10px] border border-shop-line py-3.5 text-center text-[15px] font-semibold text-shop-body transition-colors hover:border-shop-ink hover:text-shop-ink"
        >
          Continue shopping
        </Link>
      </div>

      <p className="mt-6 text-center text-[13px] leading-relaxed text-shop-muted">
        Keep your order number. Something not right?{" "}
        <a
          href={`tel:${support.phone.replace(/\s/g, "")}`}
          className="font-semibold text-shop-primary hover:underline"
        >
          Call {support.phone}
        </a>
        .
      </p>
    </main>
  );
}
