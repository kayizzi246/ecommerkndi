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
import GettingStarted from "@/components/seller/GettingStarted";

/**
 * Dashboard home.
 *
 * Ordered by what the seller has to *do*, not by what is easiest to plot: the
 * jobs list comes first, then the quick actions, then the figures. A seller
 * opening this page at 7am wants to know what is out of stock, not admire a
 * chart.
 */
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

  /**
   * An approved store — the point at which the figures below mean anything.
   *
   * A seller whose plugin predates the status field would read as unapproved
   * and lose their dashboard, so an unknown status is treated as approved: the
   * gate that actually protects the account is in SellerShell, and this only
   * decides whether to draw empty charts.
   */
  const approvedStore = !seller || seller.status === "approved" || !seller.status;

  // Everything waiting on the seller, most urgent first. Only real conditions
  // appear — an empty list means there is genuinely nothing to do.
  const jobs: {
    tone: "critical" | "warning" | "good";
    title: string;
    copy: string;
    href: string;
    action: string;
  }[] = [];

  if (stats) {
    if (stats.products_out_of_stock > 0) {
      jobs.push({
        tone: "critical",
        title: `${stats.products_out_of_stock} ${stats.products_out_of_stock === 1 ? "product is" : "products are"} out of stock`,
        copy: "Out-of-stock listings still show, but nobody can buy them. Restocking takes a few seconds.",
        href: "/seller/products?filter=outofstock",
        action: "Restock now",
      });
    }
    if (stats.products_pending > 0) {
      jobs.push({
        tone: "warning",
        title: `${stats.products_pending} ${stats.products_pending === 1 ? "listing is" : "listings are"} awaiting approval`,
        copy: "Our team is reviewing them. Nothing for you to do unless we come back with a question.",
        href: "/seller/products?filter=pending",
        action: "View them",
      });
    }
    if (stats.payout_due > 0) {
      jobs.push({
        tone: "good",
        title: `${formatPrice(stats.payout_due)} is ready to pay out`,
        copy: "Cleared earnings from completed orders. Request it whenever you want it.",
        href: "/seller/commissions",
        action: "Request payout",
      });
    }
    if (stats.products_live === 0) {
      jobs.push({
        tone: "warning",
        title: "You have no live listings",
        copy: "Nothing can sell until there is something to sell. Adding your first product takes about two minutes.",
        href: "/seller/products/new",
        action: "Add a product",
      });
    }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Page head */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight text-shop-ink">
            {seller ? `Hello, ${seller.owner_name.split(" ")[0] || seller.store_name}` : "Overview"}
          </h1>
          <p className="mt-1 text-[15px] text-shop-muted">
            How {seller?.store_name ?? "your store"} is doing on Kandi.
          </p>
        </div>
        {/* Only once the store can actually list. The backend refuses a new
            product from an unapproved seller, so before that this button leads
            to a form that ends in an error. */}
        {approvedStore && (
          <Link href="/seller/products/new" className="btn-shop px-6 py-3 text-[15px]">
            Add a product
          </Link>
        )}
      </div>

      {/* The new seller's path, in order, until the store is trading. It
          replaces the bare "awaiting approval" notice, which said what was
          happening but never what to do about it. */}
      {seller && (
        <GettingStarted seller={seller} productsLive={stats?.products_live ?? 0} />
      )}

      {seller?.status === "pending" && (
        <div className="mb-6 rounded-2xl border border-pop-orange/30 bg-pop-orange-soft px-5 py-4 text-[15px] leading-relaxed text-pop-orange">
          <span className="font-semibold">Your store is awaiting approval.</span> You can prepare
          listings now — they go live the moment our team approves your account.
        </div>
      )}

      {/* ---- What needs you ----
           Every job here links to Products, Orders or Earnings, none of which
           an unapproved store can use. Until then the checklist above is the
           list of things that genuinely need the seller. */}
      {approvedStore && jobs.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-[18px] font-extrabold text-shop-ink">What needs you</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {jobs.map((job) => (
              <li key={job.title}>
                <Link
                  href={job.href}
                  className={`flex h-full items-start gap-3.5 rounded-2xl border-l-4 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                    job.tone === "critical"
                      ? "border-l-pop-red"
                      : job.tone === "warning"
                        ? "border-l-shop-flame"
                        : "border-l-pop-green"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white ${
                      job.tone === "critical"
                        ? "bg-pop-red"
                        : job.tone === "warning"
                          ? "bg-shop-flame"
                          : "bg-pop-green"
                    }`}
                  >
                    {job.tone === "critical" ? "!" : job.tone === "warning" ? "•" : "✓"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold text-shop-ink">{job.title}</span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-shop-muted">
                      {job.copy}
                    </span>
                    <span className="mt-2 inline-block text-[14px] font-semibold text-shop-primary">
                      {job.action} ›
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Quick actions ---- */}
      {approvedStore && (
      <section className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/seller/products/new"
            label="Add a product"
            copy="List something new"
            icon="M12 5v14M5 12h14"
            tone="text-pop-green"
            bg="bg-pop-green-soft"
          />
          <QuickAction
            href="/seller/products"
            label="Edit & restock"
            copy="Prices and stock levels"
            icon="M4 7l8-3.5L20 7v10l-8 3.5L4 17V7Z"
            tone="text-pop-blue"
            bg="bg-pop-blue-soft"
          />
          <QuickAction
            href="/seller/orders"
            label="Orders to send"
            copy="What to pack today"
            icon="M3 6h2.2l2 10.5h11.1L20 9H6.2"
            tone="text-pop-violet"
            bg="bg-pop-violet-soft"
          />
          <QuickAction
            href="/seller/commissions"
            label="Get paid"
            copy="Earnings and payouts"
            icon="M12 3v18M8 7h6.5a2.5 2.5 0 0 1 0 5H9.5a2.5 2.5 0 0 0 0 5H16"
            tone="text-pop-orange"
            bg="bg-pop-orange-soft"
          />
        </div>
      </section>
      )}

      {/* ---- Figures ----
           Held back until the store is approved. Before that every one of them
           is a zero and every chart is an empty box, which reads as a broken
           dashboard rather than as a store that has not opened yet. The
           checklist above is the useful thing on the page until then. */}
      {!approvedStore ? (
        <section className="rounded-2xl border border-dashed border-shop-line bg-white p-8 text-center">
          <h2 className="text-[18px] font-extrabold text-shop-ink">
            Your sales figures appear here
          </h2>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-[15px] leading-relaxed text-shop-muted">
            Revenue, best sellers and the split by category — all of it unlocks the moment your
            store is approved and starts taking orders.
          </p>
          <Link
            href="/seller/guide"
            className="btn-shop-outline mt-5 inline-flex px-6 py-2.5 text-[15px]"
          >
            Read how selling works
          </Link>
        </section>
      ) : (
        <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-extrabold text-shop-ink">Your numbers</h2>
        <RangeFilter
          value={range}
          onChange={(next) => {
            setRefreshing(true);
            setRange(next);
          }}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-pop-red-soft px-4 py-3 text-[15px] font-medium text-pop-red"
        >
          {error}
        </p>
      )}

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-32 animate-skeleton rounded-2xl bg-shop-hairline" />
          ))}
        </div>
      ) : (
        // While refetching, the frame is held at reduced opacity — no skeleton, no jump.
        <div className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* Five across once views are being measured, four before then.
              The column count follows the tiles rather than the tiles being
              padded out to fill a fixed grid — a placeholder "—" where a real
              number will one day sit is worse than the number being absent. */}
          <div
            className={`grid gap-4 sm:grid-cols-2 ${
              stats.views === undefined ? "xl:grid-cols-4" : "xl:grid-cols-5"
            }`}
          >
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
            {/* Only when the shop is actually counting. `undefined` means the
                plugin on this install has no view counter yet, and a "0 views"
                tile in that case tells a seller their listings are dead when
                nothing has been measured at all. */}
            {stats.views !== undefined && (
              <StatTile
                label="Product views"
                value={stats.views.toLocaleString("en-UG")}
                delta={stats.views_change}
                deltaPeriod={rangeLabel}
                hint={
                  stats.views > 0 && stats.orders > 0
                    ? `${((stats.orders / stats.views) * 100).toFixed(1)}% of views ordered`
                    : stats.views > 0
                      ? "No orders from these views yet"
                      : undefined
                }
              />
            )}
            <StatTile
              label="Units sold"
              value={String(stats.units_sold)}
              hint={`Across ${stats.products_live} live ${stats.products_live === 1 ? "listing" : "listings"}`}
            />
            <StatTile
              label="Ready to pay out"
              value={formatPrice(stats.payout_due)}
              hint={`${formatPrice(stats.commission_owed)} commission outstanding`}
            />
          </div>

          <div className="mt-5">
            <RevenueChart data={stats.revenue_series} formatValue={formatPrice} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <CategorySplit data={stats.category_split} formatValue={formatPrice} />
            <TopProductsChart products={stats.top_products} formatValue={formatPrice} />
          </div>

          {/* Catalogue health */}
          <div className="mt-5 rounded-2xl border border-shop-line bg-white p-5">
            <h2 className="text-[17px] font-extrabold text-shop-ink">Catalogue health</h2>
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
                action={{ href: "/seller/products?filter=pending", label: "Review" }}
              />
              <HealthRow
                label="Out of stock"
                value={stats.products_out_of_stock}
                tone={stats.products_out_of_stock > 0 ? "critical" : "neutral"}
                action={{ href: "/seller/products?filter=outofstock", label: "Restock" }}
              />
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function QuickAction({
  href,
  label,
  copy,
  icon,
  tone,
  bg,
}: {
  href: string;
  label: string;
  copy: string;
  icon: string;
  tone: string;
  bg: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-2xl border border-shop-line bg-white p-4 transition-colors hover:border-shop-primary"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg} ${tone}`}>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-shop-ink">{label}</span>
        <span className="block text-[13px] text-shop-muted">{copy}</span>
      </span>
    </Link>
  );
}

const TONE_ICON = {
  good: { symbol: "✓", className: "bg-pop-green" },
  warning: { symbol: "!", className: "bg-shop-flame" },
  critical: { symbol: "×", className: "bg-pop-red" },
  neutral: { symbol: "–", className: "bg-shop-muted" },
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-shop-line px-4 py-3.5">
      <div className="flex items-center gap-3">
        {/* Status ships as icon + label, never colour alone. */}
        <span
          aria-hidden
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-semibold text-white ${icon.className}`}
        >
          {icon.symbol}
        </span>
        <div>
          <p className="text-[21px] font-semibold leading-none text-shop-ink">{value}</p>
          <p className="mt-1 text-[13px] text-shop-muted">{label}</p>
        </div>
      </div>
      <Link
        href={action.href}
        className="shrink-0 text-[14px] font-semibold text-shop-primary hover:underline"
      >
        {action.label}
      </Link>
    </div>
  );
}
