"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/currency";

type Props = {
  commissionRate: number;
  registrationFee: number;
};

const UNITS_MIN = 5;
const UNITS_MAX = 500;
const UNITS_STEP = 5;

const PRICE_MIN = 10_000;
const PRICE_MAX = 500_000;
const PRICE_STEP = 5_000;

/**
 * What a seller keeps from the two numbers they know: items a month and the
 * average price. The headline is net of EVERY charge, commission and the
 * monthly fee, so the figure a seller remembers is the one they will see.
 * Plain arithmetic on their own inputs, never a forecast of sales.
 */
export default function EarningsCalculator({ commissionRate, registrationFee }: Props) {
  const [units, setUnits] = useState(40);
  const [price, setPrice] = useState(60_000);

  const sales = units * price;
  const commission = Math.round(sales * (commissionRate / 100));
  const keep = Math.max(0, sales - commission - registrationFee);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.14)] ring-1 ring-shop-ink/[0.06] md:p-6">
      <h2 className="text-[17px] font-bold tracking-[-0.01em] text-shop-ink">How much could you make?</h2>

      <Slider
        label="Items you sell a month"
        display={`${units}${units === UNITS_MAX ? "+" : ""}`}
        min={UNITS_MIN}
        max={UNITS_MAX}
        step={UNITS_STEP}
        value={units}
        onChange={setUnits}
      />
      <Slider
        label="Average price"
        display={formatPrice(price)}
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={PRICE_STEP}
        value={price}
        onChange={setPrice}
      />

      <div className="mt-5 rounded-xl bg-pop-green-soft p-4">
        <p className="text-[13px] font-semibold text-pop-green">You keep every month</p>
        <p className="mt-1 text-[30px] font-bold leading-none tracking-[-0.02em] text-pop-green tabular-nums">
          {formatPrice(keep)}
        </p>
      </div>

      <dl className="mt-4 space-y-2 text-[13px]">
        <Row label="Your sales" value={formatPrice(sales)} />
        <Row label={`Commission (${commissionRate}%)`} value={`− ${formatPrice(commission)}`} />
        {registrationFee > 0 && <Row label="Monthly fee" value={`− ${formatPrice(registrationFee)}`} />}
      </dl>

      <Link href="/seller/register" className="btn-shop mt-5 w-full py-3.5 text-[15px]">
        Open your store
      </Link>
      <p className="mt-3 text-center text-[12px] text-shop-muted">
        An example using your numbers, not a promise of sales.
      </p>
    </div>
  );
}

function Slider({
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-5 block">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] font-medium text-shop-body">{label}</span>
        <span className="text-[17px] font-bold leading-none text-shop-ink tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="calc-range mt-3 w-full"
        aria-label={label}
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-shop-hairline pb-2">
      <dt className="text-shop-muted">{label}</dt>
      <dd className="font-semibold text-shop-ink tabular-nums">{value}</dd>
    </div>
  );
}
