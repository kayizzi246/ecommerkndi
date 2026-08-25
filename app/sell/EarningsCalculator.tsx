"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/currency";

type Props = {
  commissionRate: number;
  registrationFee: number;
  payoutDays: number;
};

const UNITS_MIN = 5;
const UNITS_MAX = 500;
const UNITS_STEP = 5;

const PRICE_MIN = 10_000;
const PRICE_MAX = 500_000;
const PRICE_STEP = 5_000;

/**
 * Estimates what a seller keeps, from the two numbers a seller actually knows:
 * how many items they expect to shift in a month, and what one sells for.
 *
 * Deliberately plain arithmetic on figures the seller enters themselves — it
 * is a fee calculator, not a forecast. It makes no claim about how much anyone
 * will sell, because we have no basis for one, and a landing page implying
 * guaranteed earnings is one a regulator takes an interest in.
 */
export default function EarningsCalculator({
  commissionRate,
  registrationFee,
  payoutDays,
}: Props) {
  const [units, setUnits] = useState(40);
  const [price, setPrice] = useState(60_000);

  const revenue = units * price;
  const commission = revenue * (commissionRate / 100);
  const net = revenue - commission;
  const perItem = price - price * (commissionRate / 100);
  const yearlyNet = net * 12;

  /**
   * How many items it takes to cover the monthly fee — the honest way to frame
   * it, and usually the number that answers the objection.
   *
   * The framing changed with the fee. Against a one-off charge this was "your
   * first N sales, then never again", which is a one-sentence answer. Against a
   * subscription it is N sales EVERY month, and pretending otherwise would be
   * the single most misleading thing this page could say to somebody deciding
   * whether to join.
   */
  const unitsToCoverFee = perItem > 0 ? Math.ceil(registrationFee / perItem) : 0;

  /**
   * What is actually left each month, after commission AND the fee.
   *
   * The figures above are net of commission only, which was the whole story
   * when the fee was charged once. It is not any more: a recurring cost that
   * the "what would you keep?" number quietly ignores is exactly the kind of
   * omission a seller discovers in month two and never forgives. Floored at
   * zero so a low-volume scenario reads "nothing left" rather than a negative.
   */
  const netAfterFee = Math.max(0, net - registrationFee);

  return (
    /* ---- The one surface on the page ----

       Everything on /sell is drawn with hairlines, deliberately — it is a
       document. This is the exception, and the exception is the argument: a
       ring plus a low wide shadow is how an application draws a panel you
       operate, and this panel has two live controls in it. Lifting it off the
       warm ground is what tells the reader it is a thing to touch rather than
       a thing to read, before they have read a word of it.

       Two shadows, not one. The 1px at 4% is the contact edge that keeps the
       card from floating; the 32px at 12% with a -12px spread is the ambient
       one. A single mid-size shadow is what reads as a Bootstrap card.

       `font-extrabold` came out everywhere below. Poppins is downloaded at 600
       and 700 only and `font-synthesis-weight` is off, so 800 was rendering as
       700 anyway — see the note in `page.tsx` about the headline that had the
       same problem. Now the file says what the browser does. */
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_12px_32px_-12px_rgba(17,24,39,0.12)] ring-1 ring-shop-ink/[0.06] md:p-6">
      <h3 className="text-[17px] font-bold tracking-[-0.01em] text-shop-ink">What would you keep?</h3>
      <p className="mt-1.5 text-[13.5px] leading-[1.55] text-shop-muted">
        Two numbers you already know. We take {commissionRate}% commission — nothing else is
        deducted.
      </p>

      {/* Items a month */}
      <label className="mt-5 block">
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-[13.5px] font-semibold text-shop-body">Items sold a month</span>
          <span className="text-[19px] font-bold leading-none text-shop-ink tabular-nums">
            {units}
            {units === UNITS_MAX ? "+" : ""}
          </span>
        </span>
        <input
          type="range"
          min={UNITS_MIN}
          max={UNITS_MAX}
          step={UNITS_STEP}
          value={units}
          onChange={(event) => setUnits(Number(event.target.value))}
          className="calc-range mt-3 w-full"
          aria-label="Items sold a month"
        />
        <span className="mt-1 flex justify-between text-[11.5px] text-shop-muted">
          <span>{UNITS_MIN}</span>
          <span>{UNITS_MAX}+</span>
        </span>
      </label>

      {/* Average price */}
      <label className="mt-4 block">
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-[13.5px] font-semibold text-shop-body">Average selling price</span>
          <span className="text-[19px] font-bold leading-none text-shop-ink tabular-nums">
            {formatPrice(price)}
          </span>
        </span>
        <input
          type="range"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={price}
          onChange={(event) => setPrice(Number(event.target.value))}
          className="calc-range mt-3 w-full"
          aria-label="Average selling price in Ugandan shillings"
        />
        <span className="mt-1 flex justify-between text-[11.5px] text-shop-muted">
          <span>{formatPrice(PRICE_MIN)}</span>
          <span>{formatPrice(PRICE_MAX)}</span>
        </span>
      </label>

      {/* Result */}
      <div className="mt-5 rounded-xl bg-pop-green-soft p-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-pop-green">
          You keep, every month
        </p>
        <p className="mt-1.5 text-[24px] font-bold leading-none tracking-[-0.02em] text-pop-green tabular-nums">
          {formatPrice(net)}
        </p>
        <p className="mt-2 text-[13px] text-shop-body">
          {formatPrice(perItem)} per item · {formatPrice(yearlyNet)} over 12 months
        </p>
      </div>

      <dl className="mt-4 space-y-2 text-[13px]">
        <Row label={`${units} items × ${formatPrice(price)}`} value={formatPrice(revenue)} />
        <Row
          label={`Kandi commission (${commissionRate}%)`}
          value={`− ${formatPrice(commission)}`}
          muted
        />
      </dl>

      {registrationFee > 0 && unitsToCoverFee > 0 && (
        <p className="mt-3.5 rounded-xl bg-shop-hairline p-3.5 text-[13px] leading-[1.6] text-shop-body">
          <strong className="text-shop-ink">
            The {formatPrice(registrationFee)} monthly fee
          </strong>{" "}
          is covered by {unitsToCoverFee} {unitsToCoverFee === 1 ? "sale" : "sales"} a month at
          this price, leaving{" "}
          <strong className="text-shop-ink">{formatPrice(netAfterFee)}</strong> of the figures
          above. Payouts are requested from your dashboard and settled every {payoutDays} days.
        </p>
      )}

      <p className="mt-3.5 text-[12px] leading-[1.55] text-shop-muted">
        This is arithmetic on the figures you entered, not a projection. What you actually sell
        depends on your products, your pricing and your stock — we do not promise a number.
      </p>

      <Link href="/seller/register" className="btn-shop mt-4 w-full py-3 text-[15px]">
        Get started
      </Link>
    </div>
  );
}

function Row({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-shop-hairline pb-2">
      <dt className="text-shop-muted">{label}</dt>
      <dd className={`font-semibold ${muted ? "text-shop-muted" : "text-shop-ink"}`}>{value}</dd>
    </div>
  );
}
