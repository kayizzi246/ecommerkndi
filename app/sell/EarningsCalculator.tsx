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

  // How many items it takes to cover the one-off joining fee — the honest way
  // to frame it, and usually the number that answers the objection.
  const unitsToCoverFee = perItem > 0 ? Math.ceil(registrationFee / perItem) : 0;

  return (
    <div className="rounded-2xl border border-shop-line bg-white p-6 shadow-sm md:p-8">
      <h3 className="text-[21px] font-extrabold text-shop-ink">What would you keep?</h3>
      <p className="mt-1.5 text-[15px] text-shop-muted">
        Two numbers you already know. We take {commissionRate}% commission — nothing else is
        deducted.
      </p>

      {/* Items a month */}
      <label className="mt-6 block">
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-[14px] font-semibold text-shop-body">Items sold a month</span>
          <span className="text-[26px] font-extrabold leading-none text-shop-ink">
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
        <span className="mt-1 flex justify-between text-[12px] text-shop-muted">
          <span>{UNITS_MIN}</span>
          <span>{UNITS_MAX}+</span>
        </span>
      </label>

      {/* Average price */}
      <label className="mt-5 block">
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-[14px] font-semibold text-shop-body">Average selling price</span>
          <span className="text-[26px] font-extrabold leading-none text-shop-ink">
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
        <span className="mt-1 flex justify-between text-[12px] text-shop-muted">
          <span>{formatPrice(PRICE_MIN)}</span>
          <span>{formatPrice(PRICE_MAX)}</span>
        </span>
      </label>

      {/* Result */}
      <div className="mt-6 rounded-xl bg-pop-green-soft p-5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-pop-green">
          You keep, every month
        </p>
        <p className="mt-1 text-[34px] font-black leading-none text-pop-green">
          {formatPrice(net)}
        </p>
        <p className="mt-1.5 text-[14px] text-shop-body">
          {formatPrice(perItem)} per item · {formatPrice(yearlyNet)} over 12 months
        </p>
      </div>

      <dl className="mt-4 space-y-2 text-[14px]">
        <Row label={`${units} items × ${formatPrice(price)}`} value={formatPrice(revenue)} />
        <Row
          label={`Kandi commission (${commissionRate}%)`}
          value={`− ${formatPrice(commission)}`}
          muted
        />
      </dl>

      {registrationFee > 0 && unitsToCoverFee > 0 && (
        <p className="mt-4 rounded-xl bg-shop-hairline p-4 text-[14px] leading-relaxed text-shop-body">
          <strong className="text-shop-ink">
            The one-off {formatPrice(registrationFee)} joining fee
          </strong>{" "}
          is covered by your first {unitsToCoverFee}{" "}
          {unitsToCoverFee === 1 ? "sale" : "sales"} at this price, and is never charged again.
          Payouts are requested from your dashboard and settled every {payoutDays} days.
        </p>
      )}

      <p className="mt-4 text-[13px] leading-relaxed text-shop-muted">
        This is arithmetic on the figures you entered, not a projection. What you actually sell
        depends on your products, your pricing and your stock — we do not promise a number.
      </p>

      <Link href="/seller/register" className="btn-shop mt-5 w-full py-3.5 text-[16px]">
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
