"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCustomerSession } from "@/lib/customer-session";
import SignInPanel from "@/components/SignInPanel";
import { formatPrice } from "@/lib/currency";
import {
  formatOrderDate,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type CustomerOrder,
} from "@/lib/account";

/**
 * The live half of the tracking page. Signed-in shoppers see their real order
 * statuses; everyone else gets the sign-in button, because an order can only
 * be shown to the account that placed it.
 */
export default function TrackOrderPanel() {
  const { customer, loading, refresh } = useCustomerSession();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/account/orders");
        const payload = (await response.json().catch(() => ({}))) as {
          orders?: CustomerOrder[];
          message?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.message ?? "Could not load your orders.");
          setOrders([]);
          return;
        }
        setOrders(payload.orders ?? []);
      } catch {
        if (!cancelled) {
          setError("Could not reach the store. Please try again.");
          setOrders([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customer]);

  if (loading) {
    return <div className="h-40 animate-skeleton rounded-2xl bg-shop-hairline" />;
  }

  if (!customer) {
    return (
      <div className="rounded-2xl border border-shop-line bg-white p-8 text-center">
        <p className="text-[19px] font-semibold text-shop-ink">Sign in to see your orders</p>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-shop-muted">
          Your order history is tied to your account, so we can only show it once you are signed
          in.
        </p>
        <div className="mt-5 flex justify-center">
          <SignInPanel onSuccess={refresh} />
        </div>
        {error && (
          <p role="alert" className="mt-4 text-[14px] text-shop-sale">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (orders === null) {
    return <div className="h-40 animate-skeleton rounded-2xl bg-shop-hairline" />;
  }

  if (error) {
    return (
      <p role="alert" className="rounded-2xl bg-pop-red-soft p-5 text-[15px] text-pop-red">
        {error}
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-shop-line bg-white p-10 text-center">
        <p className="text-[16px] text-shop-muted">
          Nothing to track yet — you have not placed an order with this account.
        </p>
        <Link href="/" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-shop-line bg-white p-4"
        >
          <span className="text-[16px] font-semibold text-shop-ink">#{order.number}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
              ORDER_STATUS_TONE[order.status] ?? "bg-shop-hairline text-shop-body"
            }`}
          >
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </span>
          <span className="text-[14px] text-shop-muted">{formatOrderDate(order.date)}</span>
          <span className="text-[14px] text-shop-muted">
            {order.items.length} {order.items.length === 1 ? "item" : "items"}
          </span>
          <span className="ml-auto text-[16px] font-semibold text-shop-ink">
            {formatPrice(order.total)}
          </span>
          <Link
            href="/account/orders"
            className="text-[14px] font-semibold text-shop-primary hover:underline"
          >
            Details ›
          </Link>
        </div>
      ))}
    </div>
  );
}
