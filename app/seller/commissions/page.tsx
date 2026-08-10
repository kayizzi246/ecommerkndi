"use client";

import { useEffect, useState } from "react";
import { sellerApi, type CommissionSummary } from "@/lib/seller";
import { formatPrice } from "@/lib/currency";
import { useSellerSession } from "@/lib/seller-session";
import RangeFilter, { type RangeValue } from "@/components/seller/RangeFilter";
import StatTile from "@/components/seller/StatTile";

const ENTRY_BADGE: Record<string, string> = {
  paid: "bg-[#e7f7ea] text-[#0a7a2f]",
  payable: "bg-[#fff6dd] text-[#8a6100]",
  pending: "bg-bfl-surface text-bfl-grey",
};

export default function SellerCommissionsPage() {
  const { seller } = useSellerSession();
  const [range, setRange] = useState<RangeValue>("30d");
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  // Bumped after a payout request so the statement reloads with fresh statuses.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const next = await sellerApi.commissions(range);
        if (cancelled) return;
        setSummary(next);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "Could not load your commission statement."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  const requestPayout = async () => {
    setRequesting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await sellerApi.requestPayout();
      setNotice(result.message);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a payout.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="text-[26px] font-extrabold text-black">Commissions &amp; payouts</h1>
      <p className="mt-1 text-[14px] text-bfl-grey">
        Kandi deducts {seller?.commission_rate ?? 0}% of each completed order. Everything else is yours.
      </p>

      <div className="mb-5 mt-5">
        <RangeFilter value={range} onChange={setRange} />
      </div>

      {error && (
        <p role="alert" className="mb-4 border-l-2 border-bfl-red bg-[#fdeaea] px-3 py-2 text-[14px] text-[#a51f1f]">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 border-l-2 border-bfl-green bg-[#e7f7ea] px-3 py-2 text-[14px] text-[#0a7a2f]">
          {notice}
        </p>
      )}

      {!summary ? (
        <p className="py-16 text-center text-[14px] text-bfl-grey">Loading your statement…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Gross sales" value={formatPrice(summary.gross)} hint="Before commission" />
            <StatTile
              label={`Commission (${summary.rate}%)`}
              value={formatPrice(summary.commission_total)}
              hint="Deducted by Kandi"
            />
            <StatTile label="Net earnings" value={formatPrice(summary.net_total)} hint="Your share" />
            <StatTile
              label="Ready to pay out"
              value={formatPrice(summary.payable)}
              hint={`${formatPrice(summary.pending)} still clearing`}
            />
          </div>

          {/* Payout request */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded border border-bfl-line bg-white p-5">
            <div>
              <h2 className="text-[16px] font-extrabold text-black">Request a payout</h2>
              <p className="mt-1 text-[14px] text-bfl-grey">
                {summary.payable > 0
                  ? `${formatPrice(summary.payable)} is cleared and ready to send to ${
                      seller?.payout_method || "your registered account"
                    }.`
                  : "Nothing is cleared for payout yet. Orders clear once they are marked completed."}
              </p>
            </div>
            <button
              type="button"
              onClick={requestPayout}
              disabled={requesting || summary.payable <= 0}
              className="btn-bfl px-6 py-2.5 text-[14px]"
            >
              {requesting ? "Requesting…" : "Request payout"}
            </button>
          </div>

          {/* Ledger */}
          <div className="mt-5 overflow-x-auto rounded border border-bfl-line bg-white">
            <table className="w-full min-w-[720px] text-[14px]">
              <thead className="border-b border-bfl-line bg-bfl-surface text-left text-[13px] text-bfl-grey">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 text-right font-semibold">Gross</th>
                  <th className="px-4 py-3 text-right font-semibold">Rate</th>
                  <th className="px-4 py-3 text-right font-semibold">Commission</th>
                  <th className="px-4 py-3 text-right font-semibold">Net</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                {summary.entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <p className="text-[15px] font-semibold text-black">No commission entries yet</p>
                      <p className="mt-1 text-[14px] text-bfl-grey">
                        Each completed order adds a line here.
                      </p>
                    </td>
                  </tr>
                )}

                {summary.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-bfl-line last:border-0">
                    <td className="px-4 py-3 text-[#333]">
                      {new Date(entry.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-bfl-ink">#{entry.order_id}</td>
                    <td className="px-4 py-3 text-right text-[#333]">{formatPrice(entry.gross)}</td>
                    <td className="px-4 py-3 text-right text-bfl-grey">{entry.rate}%</td>
                    <td className="px-4 py-3 text-right text-bfl-grey">
                      − {formatPrice(entry.commission)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-black">
                      {formatPrice(entry.net)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-1 text-[12px] font-semibold capitalize ${
                          ENTRY_BADGE[entry.status] ?? ENTRY_BADGE.pending
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
