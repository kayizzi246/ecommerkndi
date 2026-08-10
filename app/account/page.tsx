"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCustomerSession } from "@/lib/customer-session";
import { useWishlist } from "@/lib/wishlist";
import { formatPrice } from "@/lib/currency";
import {
  formatOrderDate,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type CustomerOrder,
  type CustomerReview,
} from "@/lib/account";

/**
 * Dashboard landing: what the shopper has spent, what is on its way, and the
 * products they have bought but not yet reviewed — the one prompt that turns a
 * delivered order into a review.
 */
export default function AccountOverview() {
  const { customer } = useCustomerSession();
  const { count: wishlistCount } = useWishlist();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [reviews, setReviews] = useState<CustomerReview[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [orderRes, reviewRes] = await Promise.all([
        fetch("/api/account/orders").catch(() => null),
        fetch("/api/account/reviews").catch(() => null),
      ]);

      if (cancelled) return;

      const orderData = orderRes?.ok
        ? ((await orderRes.json()) as { orders?: CustomerOrder[] })
        : null;
      const reviewData = reviewRes?.ok
        ? ((await reviewRes.json()) as { reviews?: CustomerReview[] })
        : null;

      if (!cancelled) {
        setOrders(orderData?.orders ?? []);
        setReviews(reviewData?.reviews ?? []);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loading = orders === null || reviews === null;
  const spent = (orders ?? []).reduce((sum, order) => sum + order.total, 0);
  const inFlight = (orders ?? []).filter((order) =>
    ["pending", "processing", "on-hold"].includes(order.status)
  ).length;

  // Everything bought and not yet reviewed, most recent order first, with a
  // product only listed once however many times it has been ordered.
  const toReview = (() => {
    const seen = new Set<number>();
    const pending: { productId: number; name: string; image: string }[] = [];
    for (const order of orders ?? []) {
      for (const item of order.items) {
        if (item.reviewed || item.product_id === 0 || seen.has(item.product_id)) continue;
        seen.add(item.product_id);
        pending.push({ productId: item.product_id, name: item.name, image: item.image });
      }
    }
    return pending.slice(0, 6);
  })();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[28px] font-extrabold leading-tight text-shop-ink">
          Hi {customer?.name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-[15px] text-shop-muted">
          Here is everything on your Kandi account.
        </p>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders" value={loading ? "—" : String(orders!.length)} tone="text-shop-ink" />
        <Stat label="On its way" value={loading ? "—" : String(inFlight)} tone="text-pop-blue" />
        <Stat
          label="Total spent"
          value={loading ? "—" : formatPrice(spent)}
          tone="text-shop-primary"
        />
        <Stat label="Saved items" value={String(wishlistCount)} tone="text-pop-pink" />
      </div>

      {/* Waiting on a review */}
      {toReview.length > 0 && (
        <section className="rounded-2xl border border-shop-line bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[19px] font-extrabold text-shop-ink">Rate what you bought</h2>
            <Link href="/account/reviews" className="text-[14px] font-semibold text-shop-primary">
              My reviews ›
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {toReview.map((item) => (
              <li key={item.productId} className="flex items-center gap-3">
                <Link
                  href={`/products/${item.productId}#reviews`}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-shop-hairline"
                >
                  {item.image && (
                    <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />
                  )}
                </Link>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[14px] text-shop-body">{item.name}</p>
                  <Link
                    href={`/products/${item.productId}#reviews`}
                    className="mt-1 inline-block text-[14px] font-semibold text-shop-primary hover:underline"
                  >
                    Write a review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent orders */}
      <section className="rounded-2xl border border-shop-line bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[19px] font-extrabold text-shop-ink">Recent orders</h2>
          <Link href="/account/orders" className="text-[14px] font-semibold text-shop-primary">
            See all ›
          </Link>
        </div>

        {loading ? (
          <div className="h-24 animate-skeleton rounded-xl bg-shop-hairline" />
        ) : orders!.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[15px] text-shop-muted">You have not ordered anything yet.</p>
            <Link href="/" className="btn-shop mt-4 inline-flex px-7 py-2.5 text-[15px]">
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-shop-hairline">
            {orders!.slice(0, 3).map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="text-[15px] font-semibold text-shop-ink">#{order.number}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                    ORDER_STATUS_TONE[order.status] ?? "bg-shop-hairline text-shop-body"
                  }`}
                >
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </span>
                <span className="text-[14px] text-shop-muted">
                  {formatOrderDate(order.date)}
                </span>
                <span className="ml-auto text-[15px] font-semibold text-shop-ink">
                  {formatPrice(order.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-shop-line bg-white p-4">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-shop-muted">
        {label}
      </p>
      <p className={`mt-1.5 text-[24px] font-semibold leading-none ${tone}`}>{value}</p>
    </div>
  );
}
