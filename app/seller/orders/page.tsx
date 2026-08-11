"use client";

import { Fragment, useEffect, useState } from "react";
import { sellerApi, type SellerOrder } from "@/lib/seller";
import { formatPrice } from "@/lib/currency";

const STATUS_FILTERS = [
  { value: "any", label: "All orders" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

/** Orders past the point where accepting them would mean anything. */
const CLOSED_STATUSES = ["completed", "cancelled", "refunded", "failed"];

const STATUS_BADGE: Record<string, string> = {
  processing: "bg-[#fff6dd] text-[#8a6100]",
  completed: "bg-[#e7f7ea] text-[#0a7a2f]",
  cancelled: "bg-bfl-surface text-bfl-grey",
  refunded: "bg-[#fdeaea] text-[#a51f1f]",
  "on-hold": "bg-bfl-surface text-bfl-grey",
  pending: "bg-bfl-surface text-bfl-grey",
};

export default function SellerOrdersPage() {
  const [status, setStatus] = useState("any");
  const [orders, setOrders] = useState<SellerOrder[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Confirms this store is packing its part of an order.
   *
   * The buyer is emailed the moment the first seller accepts, so this is a
   * promise, not a bookkeeping click — which is why the row updates from the
   * server's answer rather than optimistically.
   */
  const accept = async (order: SellerOrder) => {
    setAccepting(order.id);
    setError(null);
    setNotice(null);
    try {
      const { status: newStatus } = await sellerApi.acceptOrder(order.id);
      setOrders((current) =>
        (current ?? []).map((entry) =>
          entry.id === order.id ? { ...entry, accepted: true, status: newStatus } : entry
        )
      );
      setNotice(`Order #${order.number} accepted — the buyer has been told it is being packed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not accept that order.");
    } finally {
      setAccepting(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { orders: list } = await sellerApi.orders(status);
        if (cancelled) return;
        setOrders(list);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load your orders.");
        setOrders([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const totals = (orders ?? []).reduce(
    (sum, order) => ({
      gross: sum.gross + order.seller_total,
      commission: sum.commission + order.commission,
      net: sum.net + order.net_payout,
    }),
    { gross: 0, commission: 0, net: 0 }
  );

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="text-[26px] font-extrabold text-black">Orders &amp; sales</h1>
      <p className="mt-1 text-[14px] text-bfl-grey">
        Every order containing one of your products, with your share broken out.
      </p>

      <div className="mb-4 mt-5 flex flex-wrap gap-1">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={status === item.value}
            onClick={() => setStatus(item.value)}
            className={`rounded border px-3 py-1.5 text-[13px] transition-colors ${
              status === item.value
                ? "border-black bg-black font-semibold text-white"
                : "border-bfl-line bg-white text-[#333] hover:border-[#b0b0b0]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[14px] text-[#a51f1f]">
          {error}
        </p>
      )}

      {notice && (
        <p className="mb-4 border-l-2 border-[#0a7a2f] bg-[#e7f7ea] px-3 py-2 text-[14px] text-[#0a7a2f]">
          {notice}
        </p>
      )}

      {/* Totals for the current slice */}
      {orders !== null && orders.length > 0 && (
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Gross sales", totals.gross],
            ["Commission", totals.commission],
            ["Net payout", totals.net],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded border border-bfl-line bg-white px-4 py-3">
              <p className="text-[13px] text-bfl-grey">{label as string}</p>
              <p className="mt-1 text-[20px] font-semibold text-black">
                {formatPrice(value as number)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-bfl-line bg-white">
        <table className="w-full min-w-[860px] text-[14px]">
          <thead className="border-b border-bfl-line bg-bfl-surface text-left text-[13px] text-bfl-grey">
            <tr>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Your total</th>
              <th className="px-4 py-3 text-right font-semibold">Commission</th>
              <th className="px-4 py-3 text-right font-semibold">Net</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {orders === null && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-bfl-grey">
                  Loading…
                </td>
              </tr>
            )}

            {orders !== null && orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
                  <p className="text-[15px] font-semibold text-black">No orders in this view</p>
                  <p className="mt-1 text-[14px] text-bfl-grey">
                    Orders appear here as soon as a shopper buys one of your products.
                  </p>
                </td>
              </tr>
            )}

            {(orders ?? []).map((order) => (
              <Fragment key={order.id}>
                <tr
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  className="cursor-pointer border-b border-bfl-line hover:bg-bfl-surface"
                >
                  <td className="px-4 py-3 font-semibold text-bfl-ink">#{order.number}</td>
                  <td className="px-4 py-3 text-[#333]">
                    {new Date(order.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-black">{order.customer}</p>
                    <p className="text-[13px] text-bfl-grey">{order.city}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-1 text-[12px] font-semibold capitalize ${
                        STATUS_BADGE[order.status] ?? STATUS_BADGE.pending
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-black">
                    {formatPrice(order.seller_total)}
                  </td>
                  <td className="px-4 py-3 text-right text-bfl-grey">
                    − {formatPrice(order.commission)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-black">
                    {formatPrice(order.net_payout)}
                  </td>
                  {/* The click must not also expand the row — accepting emails
                      the buyer, so it should never happen as a side effect of
                      looking at the line items. */}
                  <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                    {CLOSED_STATUSES.includes(order.status) ? (
                      <span className="text-[13px] text-bfl-grey">—</span>
                    ) : order.accepted ? (
                      <span className="whitespace-nowrap text-[13px] font-semibold text-[#0a7a2f]">
                        ✓ Accepted
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => accept(order)}
                        disabled={accepting === order.id}
                        className="whitespace-nowrap rounded border border-black bg-black px-3 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
                      >
                        {accepting === order.id ? "Accepting…" : "Accept order"}
                      </button>
                    )}
                  </td>
                </tr>

                {expanded === order.id && (
                  <tr className="border-b border-bfl-line bg-bfl-surface">
                    <td colSpan={8} className="px-4 py-3">
                      <p className="mb-2 text-[13px] font-semibold text-black">Your items in this order</p>
                      <ul className="space-y-1.5">
                        {order.items.map((item) => (
                          <li
                            key={`${order.id}-${item.product_id}`}
                            className="flex items-baseline justify-between gap-4 text-[14px]"
                          >
                            <span className="min-w-0 truncate text-[#333]">
                              {item.quantity} × {item.name}
                            </span>
                            <span className="shrink-0 text-[#333]">
                              {formatPrice(item.total)}{" "}
                              <span className="text-bfl-grey">
                                (commission {formatPrice(item.commission)})
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
