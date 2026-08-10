"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/currency";
import {
  formatOrderDate,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type CustomerOrder,
} from "@/lib/account";

/** The shopper's WooCommerce order history, newest first. */
export default function AccountOrders() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  return (
    <div>
      <h1 className="text-[21px] font-extrabold leading-tight text-shop-ink">My orders</h1>
      <p className="mt-1 text-[15px] text-shop-muted">
        Every order placed with this account, wherever you placed it.
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-pop-red-soft p-4 text-[15px] text-pop-red">
          {error}
        </p>
      )}

      {orders === null ? (
        <div className="mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-skeleton rounded-2xl bg-shop-hairline" />
          ))}
        </div>
      ) : orders.length === 0 && !error ? (
        <div className="mt-6 rounded-2xl border border-dashed border-shop-line bg-white p-10 text-center">
          <p className="text-[16px] text-shop-muted">No orders yet.</p>
          <Link href="/" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {orders.map((order) => (
            <li key={order.id} className="overflow-hidden rounded-2xl border border-shop-line bg-white">
              <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-shop-hairline px-5 py-3.5">
                <span className="text-[16px] font-semibold text-shop-ink">#{order.number}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                    ORDER_STATUS_TONE[order.status] ?? "bg-shop-hairline text-shop-body"
                  }`}
                >
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </span>
                <span className="text-[14px] text-shop-muted">{formatOrderDate(order.date)}</span>
                <span className="ml-auto text-[17px] font-semibold text-shop-ink">
                  {formatPrice(order.total)}
                </span>
              </header>

              <ul className="divide-y divide-shop-hairline">
                {order.items.map((item, index) => (
                  <li key={`${order.id}-${item.product_id}-${index}`} className="flex gap-4 px-5 py-4">
                    <Link
                      href={item.product_id ? `/products/${item.product_id}` : "#"}
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-shop-hairline"
                    >
                      {item.image && (
                        <Image src={item.image} alt="" fill sizes="80px" className="object-cover" />
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] font-medium text-shop-ink">
                        {item.name}
                      </p>
                      <p className="mt-1 text-[14px] text-shop-muted">
                        Qty {item.quantity} · {formatPrice(item.total)}
                      </p>

                      {item.product_id > 0 && (
                        <Link
                          href={`/products/${item.product_id}#reviews`}
                          className="mt-2 inline-block text-[14px] font-semibold text-shop-primary hover:underline"
                        >
                          {item.reviewed ? "Edit your review" : "Write a review"}
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
