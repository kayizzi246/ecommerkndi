"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { sellerApi, type SellerOrder } from "@/lib/seller";
import { formatPrice } from "@/lib/currency";
import { useSellerSession } from "@/lib/seller-session";
import { printPackingSlip } from "@/lib/packing-slip";
import OrderDelivery from "@/components/seller/OrderDelivery";

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
  refunded: "bg-shop-hairline text-shop-ink",
  "on-hold": "bg-bfl-surface text-bfl-grey",
  pending: "bg-bfl-surface text-bfl-grey",
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function SellerOrdersPage() {
  const { seller } = useSellerSession();
  const [status, setStatus] = useState("any");
  const [query, setQuery] = useState("");
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

  /**
   * Filtered here rather than at the server.
   *
   * The endpoint already returns this seller's last 200 orders in one call, so
   * a round trip per keystroke would be slower and no more accurate. The phone
   * number is in the haystack on purpose: the commonest search a seller does is
   * "somebody just rang me about their parcel", and the number on the screen of
   * the phone they answered is the only thing they have to go on.
   */
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orders ?? [];

    const digits = needle.replace(/\D/g, "");

    return (orders ?? []).filter((order) => {
      const haystack = [order.number, order.customer, order.city, order.address_1]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (haystack.includes(needle)) return true;
      if (order.items.some((item) => item.name.toLowerCase().includes(needle))) return true;

      // Numbers are compared digits-only, so "0772 123" finds "+256772123456".
      return digits.length >= 3 && (order.phone ?? "").replace(/\D/g, "").includes(digits);
    });
  }, [orders, query]);

  const totals = visible.reduce(
    (sum, order) => ({
      gross: sum.gross + order.seller_total,
      commission: sum.commission + order.commission,
      net: sum.net + order.net_payout,
    }),
    { gross: 0, commission: 0, net: 0 }
  );

  const toggle = (id: number) => setExpanded(expanded === id ? null : id);

  const acceptCell = (order: SellerOrder) =>
    CLOSED_STATUSES.includes(order.status) ? (
      <span className="text-[13px] text-bfl-grey">—</span>
    ) : order.accepted ? (
      <span className="whitespace-nowrap text-[13px] font-semibold text-[#0a7a2f]">✓ Accepted</span>
    ) : (
      <button
        type="button"
        onClick={() => accept(order)}
        disabled={accepting === order.id}
        className="whitespace-nowrap rounded border border-black bg-black px-3 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {accepting === order.id ? "Accepting…" : "Accept order"}
      </button>
    );

  /** The items, the address and the slip button — the same panel in both layouts. */
  const detail = (order: SellerOrder) => (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold text-black">Your items in this order</p>
          <button
            type="button"
            onClick={() => printPackingSlip(order, seller?.store_name ?? "Kandi")}
            className="rounded border border-bfl-line bg-white px-3 py-1.5 text-[13px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0]"
          >
            Print packing slip
          </button>
        </div>

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
                <span className="text-bfl-grey">(commission {formatPrice(item.commission)})</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <OrderDelivery order={order} />
    </div>
  );

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="text-[26px] font-extrabold text-black">Orders &amp; sales</h1>
      <p className="mt-1 text-[14px] text-bfl-grey">
        Every order containing one of your products, with the buyer&apos;s delivery details and your
        share broken out.
      </p>

      <div className="mb-4 mt-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
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

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search order no., name, phone, item…"
          aria-label="Search your orders"
          className="min-w-[220px] flex-1 rounded border border-bfl-line px-3 py-1.5 text-[14px] text-[#333] placeholder:text-bfl-grey focus:border-[#b0b0b0] focus:outline-none"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 border-l-2 border-shop-ink bg-shop-hairline px-3 py-2 text-[14px] text-shop-ink"
        >
          {error}
        </p>
      )}

      {notice && (
        <p className="mb-4 border-l-2 border-[#0a7a2f] bg-[#e7f7ea] px-3 py-2 text-[14px] text-[#0a7a2f]">
          {notice}
        </p>
      )}

      {/* Totals for the current slice */}
      {orders !== null && visible.length > 0 && (
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

      {/* ---- Phones: a list of cards ----
          A seven-column table at 860px minimum meant a seller on a phone —
          which is nearly all of them — scrolled sideways to find out who an
          order was for, and sideways again to accept it. The same rows, stacked,
          with the two things they came for (the total and the accept button) in
          the first screenful. */}
      <div className="space-y-3 md:hidden">
        {orders === null && (
          <p className="py-12 text-center text-[14px] text-bfl-grey">Loading…</p>
        )}

        {orders !== null && visible.length === 0 && <EmptyState searching={query.trim() !== ""} />}

        {visible.map((order) => (
          <div key={order.id} className="rounded border border-bfl-line bg-white">
            <button
              type="button"
              onClick={() => toggle(order.id)}
              aria-expanded={expanded === order.id}
              className="flex w-full items-start justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-bfl-ink">#{order.number}</p>
                <p className="mt-0.5 truncate text-[14px] text-black">{order.customer}</p>
                <p className="text-[13px] text-bfl-grey">
                  {order.city}
                  {order.date ? ` · ${shortDate(order.date)}` : ""}
                </p>
                <span
                  className={`mt-2 inline-block rounded px-2 py-1 text-[12px] font-semibold capitalize ${
                    STATUS_BADGE[order.status] ?? STATUS_BADGE.pending
                  }`}
                >
                  {order.status}
                </span>
              </div>

              <div className="shrink-0 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                <p className="text-[15px] font-semibold text-black">
                  {formatPrice(order.seller_total)}
                </p>
                <p className="mt-0.5 text-[13px] text-bfl-grey">
                  net {formatPrice(order.net_payout)}
                </p>
                <p className="mt-2 text-[13px] text-bfl-grey">
                  {expanded === order.id ? "Hide" : "Details"}
                </p>
              </div>
            </button>

            <div className="flex items-center justify-end border-t border-bfl-line px-4 py-2.5">
              {acceptCell(order)}
            </div>

            {expanded === order.id && (
              <div className="border-t border-bfl-line bg-bfl-surface p-4">{detail(order)}</div>
            )}
          </div>
        ))}
      </div>

      {/* ---- Desktop: the table ---- */}
      <div className="hidden overflow-x-auto rounded border border-bfl-line bg-white md:block">
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

            {orders !== null && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
                  <EmptyState searching={query.trim() !== ""} />
                </td>
              </tr>
            )}

            {visible.map((order) => (
              <Fragment key={order.id}>
                <tr
                  onClick={() => toggle(order.id)}
                  className="cursor-pointer border-b border-bfl-line hover:bg-bfl-surface"
                >
                  <td className="px-4 py-3 font-semibold text-bfl-ink">#{order.number}</td>
                  <td className="px-4 py-3 text-[#333]">{order.date ? shortDate(order.date) : "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-black">{order.customer}</p>
                    {/* The phone next to the name, because the single most
                        common thing done on this screen is ringing the person
                        in the row — and it was two clicks away. */}
                    <p className="text-[13px] text-bfl-grey">
                      {[order.city, order.phone].filter(Boolean).join(" · ")}
                    </p>
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
                    {acceptCell(order)}
                  </td>
                </tr>

                {expanded === order.id && (
                  <tr className="border-b border-bfl-line bg-bfl-surface">
                    <td colSpan={8} className="px-4 py-3">
                      {detail(order)}
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

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <>
      <p className="text-[15px] font-semibold text-black">
        {searching ? "Nothing matches that search" : "No orders in this view"}
      </p>
      <p className="mt-1 text-[14px] text-bfl-grey">
        {searching
          ? "Try an order number, the buyer's name or the last few digits of their phone."
          : "Orders appear here as soon as a shopper buys one of your products."}
      </p>
    </>
  );
}
