"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ownerApi, OwnerApiError, type OwnerOrderRow, type OwnerStats } from "@/lib/owner";
import { formatPrice } from "@/lib/currency";
import { formatUgPhone, normaliseUgPhone } from "@/lib/phone";
import RangeFilter, { type RangeValue } from "@/components/seller/RangeFilter";
import StatTile from "@/components/seller/StatTile";
import RevenueChart from "@/components/seller/RevenueChart";
import TopProductsChart from "@/components/seller/TopProductsChart";

/**
 * The admin front page, ordered by where the next shilling comes from.
 *
 *   1. Unfinished payments: shoppers who reached the payment step this week and
 *      stopped. A call or a WhatsApp message is the cheapest sale the shop can
 *      make, because the shopper has already chosen.
 *   2. Paid orders waiting to be sent, oldest first.
 *   3. Best sellers that are sold out, which lose sales every hour they stay so.
 *   4. The figures, last, because they report on sales rather than make them.
 */
export default function AdminSalesPage() {
  const router = useRouter();
  const [range, setRange] = useState<RangeValue>("30d");
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The WordPress plugin on this install predates /owner/stats. */
  const [missingEndpoint, setMissingEndpoint] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const next = await ownerApi.stats(range);
        if (cancelled) return;
        setStats(next);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof OwnerApiError && caught.status === 401) {
          router.replace("/admin/login");
          return;
        }
        // WordPress answers an unknown route with 404 "rest_no_route".
        if (caught instanceof OwnerApiError && caught.status === 404) {
          setMissingEndpoint(true);
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not load your sales.");
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range, router]);

  const rangeLabel =
    range === "mtd" ? "vs last month" : range === "ytd" ? "vs last year" : "vs previous period";

  if (missingEndpoint) {
    return (
      <div className="mx-auto max-w-[720px] rounded-2xl border border-shop-line bg-white p-6">
        <h1 className="text-[21px] font-extrabold text-shop-ink">Sales overview needs a plugin update</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-shop-muted">
          Upload the latest <code>wordpress/kandi-owner-api.php</code> (version 1.1.0) to
          wp-content/plugins/kandi-owner-api/ on your WordPress site. Your sales, unfinished
          payments and orders to send will then show here.
        </p>
        <Link href="/admin/products" className="btn-shop mt-5 inline-flex px-6 py-2.5 text-[14px]">
          Go to products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[27px] font-extrabold leading-tight text-shop-ink">Sales</h1>
          <p className="mt-1 text-[14px] text-shop-muted">
            Money to win back first, then orders to send, then the numbers.
          </p>
        </div>
        <Link href="/admin/products" className="btn-shop-outline px-5 py-2.5 text-[14px]">
          Manage products
        </Link>
      </div>

      {error && (
        <p role="alert" className="mb-5 rounded-xl bg-pop-red-soft px-4 py-3 text-[14px] font-medium text-pop-red">
          {error}
        </p>
      )}

      {!stats ? (
        !error && (
          <div className="grid gap-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-36 animate-skeleton rounded-2xl bg-shop-hairline" />
            ))}
          </div>
        )
      ) : (
        <>
          <RecoverSection rows={stats.recover} total={stats.recover_total} />
          <ToShipSection rows={stats.to_ship} />
          <SoldOutSection products={stats.sold_out_best} totalSoldOut={stats.products_sold_out} />

          <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-extrabold text-shop-ink">Your numbers</h2>
            <RangeFilter
              value={range}
              onChange={(next) => {
                setRefreshing(true);
                setRange(next);
              }}
            />
          </div>

          <div className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
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
                label="Average order"
                value={formatPrice(stats.average_order)}
                hint="Raise it with bundles and the free delivery threshold"
              />
              <StatTile
                label="Units sold"
                value={String(stats.units_sold)}
                hint={`${stats.products_live} live products, ${stats.products_sold_out} sold out`}
              />
            </div>

            <div className="mt-5">
              <RevenueChart data={stats.revenue_series} formatValue={formatPrice} />
            </div>

            <div className="mt-5">
              <TopProductsChart products={stats.top_products} formatValue={formatPrice} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function RecoverSection({ rows, total }: { rows: OwnerOrderRow[]; total: number }) {
  return (
    <section className="mb-6 rounded-2xl border-l-4 border-l-pop-red bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-extrabold text-shop-ink">
          {rows.length > 0
            ? `${rows.length} ${rows.length === 1 ? "shopper" : "shoppers"} did not finish paying`
            : "No unfinished payments this week"}
        </h2>
        {rows.length > 0 && (
          <p className="text-[15px] font-semibold text-pop-red">{formatPrice(total)} to win back</p>
        )}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-shop-muted">
        {rows.length > 0
          ? "They chose the items and reached the payment step in the last 7 days. Call or message them today: most just need help with Mobile Money or a reminder."
          : "Everyone who reached the payment step in the last 7 days either paid or already ordered again."}
      </p>

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-shop-line">
          {rows.map((row) => (
            <OrderLine key={row.id} row={row} mode="recover" />
          ))}
        </ul>
      )}
    </section>
  );
}

function ToShipSection({ rows }: { rows: OwnerOrderRow[] }) {
  const late = rows.filter((row) => hoursSince(row.created_at) >= 48).length;

  return (
    <section className="mb-6 rounded-2xl border-l-4 border-l-shop-flame bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-extrabold text-shop-ink">
          {rows.length > 0
            ? `${rows.length} paid ${rows.length === 1 ? "order" : "orders"} to send`
            : "Nothing waiting to be sent"}
        </h2>
        {late > 0 && (
          <p className="text-[13px] font-semibold text-pop-red">
            {late} waiting more than 2 days
          </p>
        )}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-shop-muted">
        Oldest first. Fast delivery is what turns a first order into a second one.
      </p>

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-shop-line">
          {rows.map((row) => (
            <OrderLine key={row.id} row={row} mode="ship" />
          ))}
        </ul>
      )}
    </section>
  );
}

function SoldOutSection({
  products,
  totalSoldOut,
}: {
  products: OwnerStats["sold_out_best"];
  totalSoldOut: number;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border-l-4 border-l-pop-orange bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-extrabold text-shop-ink">
          Best sellers that are sold out
        </h2>
        <Link href="/admin/products" className="text-[13px] font-semibold text-shop-primary hover:underline">
          Restock in Products ›
        </Link>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-shop-muted">
        These have sold before and nobody can buy them now. {totalSoldOut} live products are out of
        stock in total.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id} className="flex items-center gap-3 rounded-xl border border-shop-line p-3">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-shop-surface">
              {product.image && (
                <Image src={product.image} alt="" fill sizes="48px" className="object-cover" />
              )}
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 block text-[13px] font-semibold leading-snug text-shop-ink">
                {product.name}
              </span>
              <span className="mt-0.5 block text-[12px] text-shop-muted">
                {product.units_sold} sold · {formatPrice(product.price)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------------- */

function OrderLine({ row, mode }: { row: OwnerOrderRow; mode: "recover" | "ship" }) {
  const phone = normaliseUgPhone(row.phone);
  const hours = hoursSince(row.created_at);
  const firstName = row.customer.split(" ")[0] || "there";
  const itemsText =
    row.items.length > 2 ? `${row.items.slice(0, 2).join(", ")} +${row.items.length - 2} more` : row.items.join(", ");

  const message =
    mode === "recover"
      ? `Hello ${firstName}, this is Kandi. We saw you were ordering ${itemsText} (${formatPrice(row.total)}) but the payment did not go through. Can we help you finish the order? You can pay with MTN or Airtel Money.`
      : `Hello ${firstName}, this is Kandi. Your order #${row.number} (${itemsText}) is being prepared. When is a good time to deliver?`;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-[240px]">
        <p className="text-[14px] font-semibold text-shop-ink">
          {row.customer}
          <span className="ml-2 text-[12px] font-normal text-shop-muted">
            #{row.number} · {row.city || "No city"} ·{" "}
            <span className={mode === "ship" && hours >= 48 ? "font-semibold text-pop-red" : undefined}>
              {timeAgo(hours)}
            </span>
          </span>
        </p>
        <p className="mt-0.5 truncate text-[13px] text-shop-muted">{itemsText}</p>
      </div>

      <p className="price w-[110px] text-right text-[15px] font-bold text-shop-ink">{formatPrice(row.total)}</p>

      <div className="flex flex-wrap gap-2">
        {phone && (
          <>
            <a
              href={`tel:${phone}`}
              className="rounded-full border border-shop-line px-3.5 py-1.5 text-[12px] font-semibold text-shop-ink hover:border-shop-primary"
              title={formatUgPhone(phone)}
            >
              Call
            </a>
            <a
              href={`https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#25d366] px-3.5 py-1.5 text-[12px] font-semibold text-[#128c4a]"
            >
              WhatsApp
            </a>
          </>
        )}
        <a
          href={row.edit_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-shop-ink px-3.5 py-1.5 text-[12px] font-semibold text-white"
        >
          Open order
        </a>
      </div>
    </li>
  );
}

function hoursSince(iso: string | null): number {
  if (!iso) return 0;
  const then = Date.parse(iso);
  return Number.isFinite(then) ? Math.max(0, (Date.now() - then) / 3_600_000) : 0;
}

function timeAgo(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
