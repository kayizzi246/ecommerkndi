"use client";

import { useCallback, useEffect, useState } from "react";
import {
  sellerApi,
  type CommissionSummary,
  type PayoutOverview,
  type PayoutRequest,
} from "@/lib/seller";
import { formatPrice } from "@/lib/currency";
import { useSellerSession } from "@/lib/seller-session";
import RangeFilter, { type RangeValue } from "@/components/seller/RangeFilter";
import StatTile from "@/components/seller/StatTile";
import PayoutDialog from "@/components/seller/PayoutDialog";

const ENTRY_BADGE: Record<string, string> = {
  paid: "bg-[#e7f7ea] text-[#0a7a2f]",
  payable: "bg-[#fff6dd] text-[#8a6100]",
  pending: "bg-bfl-surface text-bfl-grey",
};

const PAYOUT_BADGE: Record<string, string> = {
  requested: "bg-[#fff6dd] text-[#8a6100]",
  paid: "bg-[#e7f7ea] text-[#0a7a2f]",
  cancelled: "bg-bfl-surface text-bfl-grey",
};

/** What a seller calls each state. "Requested" is a form; "Processing" is news. */
const PAYOUT_LABEL: Record<string, string> = {
  requested: "Processing",
  paid: "Sent",
  cancelled: "Cancelled",
};

/**
 * Where a payout is being sent, in words, from two fields either of which can
 * be blank.
 *
 * Both are guaranteed on anything requested through the dialog — the endpoint
 * refuses a payout with no account on it. Rows raised before that rule existed
 * carry whatever was on the seller's profile at the time, which for a seller
 * who had never filled in Settings was a method and an empty number. Rendered
 * naively that came out as "sending to  (MTN Mobile Money)" with a hole in the
 * middle of the sentence, and as a bare em dash in the table.
 */
const payoutDestination = (payout: { account: string; method: string }) => {
  if (payout.account && payout.method) return `${payout.account} (${payout.method})`;
  return payout.account || payout.method || "the account on file";
};

const longDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function SellerCommissionsPage() {
  const { seller } = useSellerSession();
  const [range, setRange] = useState<RangeValue>("30d");
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [payouts, setPayouts] = useState<PayoutOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);

  /**
   * Whether this install's plugin has GET /seller/payouts.
   *
   * `null` while we find out. It matters because the dialog is built entirely
   * from that call — the balance, the floor, the methods, the account — and a
   * Seller Centre deployed ahead of the WordPress plugin would otherwise show a
   * "Request payout" button that is permanently disabled, which is a worse
   * failure than the old behaviour it replaced. When the call is missing the
   * page falls back to exactly that old behaviour: one button, whole balance,
   * no dialog. Honest, and it still pays people.
   */
  const [dialogSupported, setDialogSupported] = useState<boolean | null>(null);

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

  /**
   * The payout side, loaded separately and — deliberately — not tied to the
   * range filter.
   *
   * A balance is not a period. "Last 7 days" is a question about the statement;
   * what is cleared and withdrawable is the same number whichever answer is on
   * screen, and showing it inside a date filter invited sellers to believe that
   * narrowing the range had taken money off their balance.
   *
   * A missing endpoint is swallowed rather than raised: an install still running
   * the previous plugin has no GET /seller/payouts, and an error banner over a
   * working statement would be a lie about the statement.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const next = await sellerApi.payouts();
        if (cancelled) return;
        setPayouts(next);
        setDialogSupported(true);
      } catch {
        if (cancelled) return;
        setPayouts(null);
        setDialogSupported(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const onRequested = useCallback((payout: PayoutRequest, message: string) => {
    setDialogOpen(false);
    setNotice(message);
    /* The panel below re-renders from the server's copy of the request rather
       than from what the dialog sent, because those can differ: payouts settle
       whole orders, so the amount that comes back may be a little under what
       was typed. Showing the typed figure would be the one number a seller
       later says they were promised. */
    setPayouts((current) =>
      current
        ? { ...current, open: true, payouts: [payout, ...current.payouts] }
        : current
    );
    setReloadKey((key) => key + 1);
  }, []);

  /** The pre-dialog behaviour: ask for the whole cleared balance, no questions. */
  const requestEverything = async () => {
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

  /**
   * The statement as a spreadsheet.
   *
   * Sellers here reconcile against a book or a bank app, and re-typing forty
   * rows off a screen is where the disagreements come from. Built in the
   * browser from data already loaded — no round trip, and nothing new to
   * secure, since it is the same rows already on the page.
   */
  const exportCsv = () => {
    if (!summary) return;

    const cell = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const rows = [
      ["Date", "Order", "Gross", "Rate %", "Commission", "Net", "Status"],
      ...summary.entries.map((entry) => [
        new Date(entry.date).toISOString().slice(0, 10),
        `#${entry.order_id}`,
        entry.gross,
        entry.rate,
        entry.commission,
        entry.net,
        entry.status,
      ]),
    ];

    const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n");
    // A BOM, because the spreadsheet most of these are opened in is Excel, and
    // Excel reads a UTF-8 CSV without one as Latin-1 and mangles every name.
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `kandi-earnings-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openPayout = payouts?.payouts.find((entry) => entry.status === "requested") ?? null;

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="text-[26px] font-extrabold text-black">Commissions &amp; payouts</h1>
      <p className="mt-1 text-[14px] text-bfl-grey">
        Kandi deducts {seller?.commission_rate ?? 0}% of each completed order. Everything else is
        yours.
      </p>

      <div className="mb-5 mt-5 flex flex-wrap items-center justify-between gap-3">
        <RangeFilter value={range} onChange={setRange} />

        <button
          type="button"
          onClick={exportCsv}
          disabled={!summary || summary.entries.length === 0}
          className="rounded border border-bfl-line bg-white px-3 py-1.5 text-[13px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0] disabled:opacity-40"
        >
          Download CSV
        </button>
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
              value={formatPrice(payouts?.payable ?? summary.payable)}
              /* A cleared row stays cleared until finance settles it, so this
                 figure does not drop when a payout is requested. Saying which
                 part of it is already spoken for is the difference between that
                 reading as a balance and reading as a bug. */
              hint={
                openPayout
                  ? `${formatPrice(openPayout.amount)} of this is being paid out`
                  : `${formatPrice(payouts?.pending ?? summary.pending)} still clearing`
              }
            />
          </div>

          {/* ---- Payout: either a request in flight, or the way to make one ---- */}
          {openPayout ? (
            <div className="mt-5 rounded border border-[#f0d9a5] bg-[#fffdf6] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-[16px] font-extrabold text-black">
                  Payout of {formatPrice(openPayout.amount)} is being processed
                </h2>
                <span className="rounded bg-[#fff6dd] px-2 py-1 text-[12px] font-semibold text-[#8a6100]">
                  Processing
                </span>
              </div>

              <p className="mt-2 text-[14px] text-[#333]">
                Requested {longDate(openPayout.requested_at)} · sending to{" "}
                <strong>{payoutDestination(openPayout)}</strong>.
              </p>

              {/* A progress bar with no percentage behind it would be theatre.
                  What a seller needs here is the promise in words and the
                  knowledge that a receipt is already in their inbox. */}
              <p className="mt-3 text-[14px] text-bfl-grey">
                We settle every request within <strong className="text-[#333]">24 hours</strong>. A
                confirmation is already in your email, and we will write again the moment the money
                goes out. You can request the next payout once this one is sent.
              </p>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded border border-bfl-line bg-white p-5">
              <div>
                <h2 className="text-[16px] font-extrabold text-black">Request a payout</h2>
                <p className="mt-1 text-[14px] text-bfl-grey">
                  {(payouts?.payable ?? summary.payable) > 0
                    ? `${formatPrice(payouts?.payable ?? summary.payable)} is cleared and ready to send to ${
                        payouts?.account || seller?.payout_account || "your registered account"
                      }.`
                    : "Nothing is cleared for payout yet. Orders clear once they are marked completed."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => (dialogSupported ? setDialogOpen(true) : requestEverything())}
                disabled={
                  requesting ||
                  dialogSupported === null ||
                  (payouts ? payouts.payable : summary.payable) <= 0
                }
                className="btn-bfl px-6 py-2.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {requesting ? "Requesting…" : "Request payout"}
              </button>
            </div>
          )}

          {/* ---- Payout history ---- */}
          {payouts && payouts.payouts.length > 0 && (
            <div className="mt-5 overflow-x-auto rounded border border-bfl-line bg-white">
              <table className="w-full min-w-[600px] text-[14px]">
                <caption className="border-b border-bfl-line px-4 py-3 text-left text-[15px] font-extrabold text-black">
                  Your payouts
                </caption>
                <thead className="border-b border-bfl-line bg-bfl-surface text-left text-[13px] text-bfl-grey">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Requested</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Sent to</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Paid</th>
                  </tr>
                </thead>
                <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                  {payouts.payouts.map((payout) => (
                    <tr key={payout.id} className="border-b border-bfl-line last:border-0">
                      <td className="px-4 py-3 text-[#333]">{longDate(payout.requested_at)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-black">
                        {formatPrice(payout.amount)}
                      </td>
                      <td className="px-4 py-3 text-[#333]">
                        {/* The number on its own line and the method under it,
                            but only when there are two things to say — a row
                            with no account must not print an em dash above its
                            own method, which reads as missing data rather than
                            as the one field it is. */}
                        {payout.account ? (
                          <>
                            {payout.account}
                            {payout.method && (
                              <span className="block text-[13px] text-bfl-grey">
                                {payout.method}
                              </span>
                            )}
                          </>
                        ) : (
                          payout.method || "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-1 text-[12px] font-semibold ${
                            PAYOUT_BADGE[payout.status] ?? PAYOUT_BADGE.requested
                          }`}
                        >
                          {PAYOUT_LABEL[payout.status] ?? payout.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#333]">{longDate(payout.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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

      {dialogOpen && payouts && (
        <PayoutDialog
          overview={payouts}
          onClose={() => setDialogOpen(false)}
          onDone={onRequested}
        />
      )}
    </div>
  );
}
