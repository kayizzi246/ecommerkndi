"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sellerApi, type SellerStats } from "@/lib/seller";
import { useSellerSession } from "@/lib/seller-session";
import { formatPrice } from "@/lib/currency";
import RangeFilter, { type RangeValue } from "@/components/seller/RangeFilter";
import StatTile from "@/components/seller/StatTile";
import RevenueChart from "@/components/seller/RevenueChart";
import TopProductsChart from "@/components/seller/TopProductsChart";
import CategorySplit from "@/components/seller/CategorySplit";

export default function SellerOverviewPage() {
  const { seller } = useSellerSession();
  const [range, setRange] = useState<RangeValue>("30d");
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Refetch whenever the range changes. The cancelled flag means a slow reply
  // for an old range can never overwrite the figures for the current one.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const next = await sellerApi.stats(range);
        if (cancelled) return;
        setStats(next);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load your figures.");
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const rangeLabel =
    range === "mtd" ? "vs last month" : range === "ytd" ? "vs last year" : "vs previous period";

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Page head */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-black">
            {seller ? `Hello, ${seller.owner_name.split(" ")[0]}` : "Overview"}
          </h1>
          <p className="mt-1 text-[13px] text-bfl-grey">
            How {seller?.store_name ?? "your store"} is performing on Kandi.
          </p>
        </div>
        <Link href="/seller/products/new" className="btn-bfl px-5 py-2.5 text-[13px]">
          Add a product
        </Link>
      </div>

      {seller?.status === "pending" && (
        <div className="mb-5 border-l-4 border-bfl-yellow bg-[#fffbea] px-4 py-3 text-[13px] text-[#6b5200]">
          <span className="font-bold">Your store is awaiting approval.</span> You can prepare
          listings now — they go live the moment our team approves your account.
        </div>
      )}

      {/* Filter row scopes everything below it */}
      <div className="mb-5">
        <RangeFilter
          value={range}
          onChange={(next) => {
            setRefreshing(true);
            setRange(next);
          }}
        />
      </div>

      {error && (
        <p role="alert" className="mb-5 border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[13px] text-[#a51f1f]">
          {error}
        </p>
      )}

      {!stats ? (
        <p className="py-16 text-center text-[13px] text-bfl-grey">Loading your figures…</p>
      ) : (
        // While refetching, the frame is held at reduced opacity — no skeleton, no jump.
        <div className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Revenue"
              value={formatPrice(stats.revenue)}
              delta={stats.revenue_change}
              deltaPeriod={rangeLabel}
              trend={stats.revenue_series.map((point) => point.revenue)}
            />
            <StatTile
              label="Orders"
              value={String(stats.orders)}
              delta={stats.orders_change}
              deltaPeriod={rangeLabel}
              trend={stats.revenue_series.map((point) => point.orders)}
            />
            <StatTile
              label="Units sold"
              value={String(stats.units_sold)}
              hint={`Across ${stats.products_live} live ${stats.products_live === 1 ? "listing" : "listings"}`}
            />
            <StatTile
              label="Payout due"
              value={formatPrice(stats.payout_due)}
              hint={`${formatPrice(stats.commission_owed)} commission outstanding`}
            />
          </div>

          {/* Revenue trend */}
          <div className="mt-5">
            <RevenueChart data={stats.revenue_series} formatValue={formatPrice} />
          </div>

          {/* Split + best sellers */}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <CategorySplit data={stats.category_split} formatValue={formatPrice} />
            <TopProductsChart products={stats.top_products} formatValue={formatPrice} />
          </div>

          {/* Catalogue health */}
          <div className="mt-5 rounded border border-bfl-line bg-white p-4">
            <h2 className="text-[15px] font-bold text-black">Catalogue health</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <HealthRow
                label="Live listings"
                value={stats.products_live}
                tone="good"
                action={{ href: "/seller/products", label: "Manage" }}
              />
              <HealthRow
                label="Awaiting approval"
                value={stats.products_pending}
                tone={stats.products_pending > 0 ? "warning" : "neutral"}
                action={{ href: "/seller/products", label: "Review" }}
              />
              <HealthRow
                label="Out of stock"
                value={stats.products_out_of_stock}
                tone={stats.products_out_of_stock > 0 ? "critical" : "neutral"}
                action={{ href: "/seller/products", label: "Restock" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TONE_ICON = {
  good: { symbol: "✓", color: "var(--status-good)" },
  warning: { symbol: "!", color: "var(--status-warning)" },
  critical: { symbol: "×", color: "var(--status-critical)" },
  neutral: { symbol: "–", color: "var(--text-muted)" },
} as const;

function HealthRow({
  label,
  value,
  tone,
  action,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONE_ICON;
  action: { href: string; label: string };
}) {
  const icon = TONE_ICON[tone];
  return (
    <div className="viz-root flex items-center justify-between gap-3 rounded border border-bfl-line px-3 py-3">
      <div className="flex items-center gap-2.5">
        {/* Status ships as icon + label, never colour alone. */}
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: icon.color }}
        >
          {icon.symbol}
        </span>
        <div>
          <p className="text-[18px] font-semibold leading-none text-black">{value}</p>
          <p className="mt-1 text-[12px] text-bfl-grey">{label}</p>
        </div>
      </div>
      <Link href={action.href} className="link-bfl shrink-0 text-[12px] font-bold">
        {action.label}
      </Link>
    </div>
  );
}
