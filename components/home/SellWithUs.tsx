import Link from "next/link";
import { formatPrice } from "@/lib/currency";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * The one place on the shopper-facing storefront that recruits sellers.
 *
 * It sits at the foot of the homepage rather than the top, and it is one band
 * rather than a pop-up, because the people worth recruiting are the ones who
 * already scrolled a whole page of a shop they like — a trader who sees the
 * catalogue first is a better prospect than one interrupted before they saw
 * anything.
 *
 * Every number is the shop's own, read from wp-admin: the commission rate, the
 * payout frequency, the monthly fee. Nothing here is a claim the Seller Centre
 * does not keep, because a seller who joins on a promise that turns out to be
 * decoration is a seller who leaves in a month and tells people why.
 *
 * The store count is only printed once there are enough stores for it to be an
 * argument. "Join 2 stores" is a reason not to.
 */
export default function SellWithUs({
  settings,
  storeCount,
}: {
  settings: SiteSettings;
  storeCount: number;
}) {
  const { commission_rate: commission, payout_days: payoutDays, registration_fee: fee } = settings.seller;

  const facts = [
    {
      figure: `${commission}%`,
      label: "commission",
      detail: "Charged only when something sells. No listing fees, no monthly fee.",
    },
    {
      figure: payoutDays === 7 ? "Weekly" : `${payoutDays} days`,
      label: "payouts",
      detail: "Straight to mobile money, on a schedule you can plan around.",
    },
    {
      figure: fee > 0 ? formatPrice(fee) : "Free",
      label: fee > 0 ? "to join, once" : "to join",
      detail:
        fee > 0
          ? "One payment, never again — it covers your store setup and checks."
          : "No monthly fee at all. Open a store and start listing.",
    },
  ];

  return (
    <section className="rounded-2xl border border-shop-line bg-white p-6 md:p-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-shop-primary">
            Sell on Kandi
          </p>
          <h2 className="heading-black mt-1.5 text-[24px] leading-tight text-shop-ink md:text-[30px]">
            You have the stock. We have the shoppers.
          </h2>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-shop-body">
            Put your products in front of everyone browsing this page — we handle the storefront,
            the payments and the delivery, and you pack the orders.
            {storeCount >= 5 && (
              <> {storeCount} stores already sell here.</>
            )}
          </p>

          <dl className="mt-6 grid gap-5 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="flex items-baseline gap-1.5">
                  <span className="price text-[22px] text-shop-ink">{fact.figure}</span>
                  <span className="text-[13.5px] font-semibold text-shop-body">{fact.label}</span>
                </dt>
                <dd className="mt-1 text-[13.5px] leading-[1.5] text-shop-muted">{fact.detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 lg:w-[240px]">
          <Link
            href="/sell"
            className="rounded-lg bg-shop-primary px-7 py-3.5 text-center text-[15px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Start selling
          </Link>
          <Link
            href="/seller/login"
            className="rounded-lg border border-shop-line px-7 py-3 text-center text-[14px] font-semibold text-shop-ink transition-colors hover:border-shop-primary hover:text-shop-primary"
          >
            I already have a store
          </Link>
          <p className="text-center text-[12.5px] text-shop-muted">
            Takes about three minutes to apply.
          </p>
        </div>
      </div>
    </section>
  );
}
