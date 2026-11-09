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
    <div className="overflow-hidden rounded-3xl bg-white text-shop-ink shadow-[0_32px_64px_-24px_rgba(0,0,0,0.6)]">
      {/* The answer first, in the shop's yellow; the controls that move it below. */}
      <div className="bg-shop-primary px-5 pb-5 pt-4 md:px-6">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.1em]">You could keep every month</h2>
        <p className="mt-2 text-[36px] font-black leading-none tracking-[-0.03em] tabular-nums md:text-[42px]">
          {formatPrice(keep)}
        </p>
      </div>

      <div className="px-5 pb-5 md:px-6">
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

      <dl className="mt-5 space-y-2 text-[13px]">
        <Row label="Your sales" value={formatPrice(sales)} />
        <Row label={`Commission (${commissionRate}%)`} value={`− ${formatPrice(commission)}`} />
        {registrationFee > 0 && <Row label="Monthly fee" value={`− ${formatPrice(registrationFee)}`} />}
      </dl>

      <Link
        href="/seller/register"
        className="mt-5 flex w-full items-center justify-center rounded-full bg-shop-ink py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-black"
      >
        Open your store
      </Link>
      <p className="mt-3 text-center text-[12px] text-shop-muted">
        An example using your numbers, not a promise of sales.
      </p>
      </div>
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
