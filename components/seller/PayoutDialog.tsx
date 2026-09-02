"use client";

import { useEffect, useRef, useState } from "react";
import { sellerApi, type PayoutOverview, type PayoutRequest } from "@/lib/seller";
import { formatPrice } from "@/lib/currency";

/**
 * "Request a payout", as a decision rather than a button.
 *
 * The button used to send the seller's entire cleared balance to whichever
 * account happened to be on file, with no confirmation and no chance to say how
 * much — so a seller who wanted 100,000 for stock and to leave the rest with us
 * had no way to ask for that, and a seller whose mobile money number had changed
 * found out when the money went to the old one.
 *
 * Three things have to be settled before money moves, and this asks all three
 * on one screen: how much, by what method, and to which number. The method and
 * number are prefilled from the account and written back on submit, so a seller
 * who never changes them still only reads and confirms.
 */
export default function PayoutDialog({
  overview,
  onClose,
  onDone,
}: {
  overview: PayoutOverview;
  onClose: () => void;
  /** Handed the payout the server actually created, plus its own wording. */
  onDone: (payout: PayoutRequest, message: string) => void;
}) {
  const methods = overview.methods.length > 0 ? overview.methods : ["MTN Mobile Money"];

  const [method, setMethod] = useState(
    overview.method && methods.includes(overview.method) ? overview.method : methods[0]
  );
  const [account, setAccount] = useState(overview.account ?? "");

  /* Held as a string, not a number: an amount box that cannot be emptied
     because "" is not a number is the most irritating field on the internet. */
  const [amount, setAmount] = useState(String(Math.floor(overview.payable)));

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);

  // Escape closes, which is the one keyboard convention people try without
  // being told. Locking the page behind the dialog stops the statement
  // scrolling underneath on a phone.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) onClose();
    };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, sending]);

  const value = Number(amount || 0);
  const tooMuch = value > overview.payable + 0.01;
  const tooLittle = value > 0 && value < overview.minimum - 0.01;
  const invalid = !account.trim() || value <= 0 || tooMuch || tooLittle;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid || sending) return;

    setSending(true);
    setError(null);
    try {
      const result = await sellerApi.requestPayout({
        amount: value,
        method,
        account: account.trim(),
      });
      onDone(result.payout, result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request that payout.");
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      /* The backdrop closes, the sheet does not — hence the guard on the
         target rather than a handler on a sibling element. */
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payout-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-[440px] sm:rounded-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="payout-title" className="text-[19px] font-extrabold text-black">
              Request a payout
            </h2>
            <p className="mt-1 text-[13px] text-bfl-grey">
              {formatPrice(overview.payable)} is cleared and ready to send.
              {overview.pending > 0 && ` ${formatPrice(overview.pending)} is still clearing.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded p-1.5 text-[20px] leading-none text-bfl-grey hover:text-black disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="mt-5">
          <fieldset disabled={sending} className="space-y-5">
            <div>
              <span className="mb-2 block text-[13px] font-semibold text-black">
                Send it by
              </span>
              <div className="space-y-2">
                {methods.map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-3 rounded border px-3 py-2.5 text-[14px] transition-colors ${
                      method === option
                        ? "border-black bg-bfl-surface text-black"
                        : "border-bfl-line text-[#333] hover:border-[#b0b0b0]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payout-method"
                      value={option}
                      checked={method === option}
                      onChange={() => setMethod(option)}
                      className="h-4 w-4 accent-black"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="payout-account" className="mb-1.5 block text-[13px] font-semibold text-black">
                {method === "Bank transfer" ? "Account number" : "Mobile money number"}
              </label>
              <input
                id="payout-account"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                inputMode={method === "Bank transfer" ? "text" : "tel"}
                placeholder={method === "Bank transfer" ? "Account number" : "0772 123 456"}
                required
                className="w-full rounded border border-bfl-line px-3 py-2.5 text-[16px] text-black placeholder:text-bfl-grey focus:border-black focus:outline-none"
              />
              <p className="mt-1.5 text-[13px] text-bfl-grey">
                This is saved to your account for next time.
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <label htmlFor="payout-amount" className="text-[13px] font-semibold text-black">
                  How much
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAmount(String(Math.floor(overview.payable)));
                    amountRef.current?.focus();
                  }}
                  className="text-[13px] font-semibold text-bfl-ink underline underline-offset-2"
                >
                  Withdraw all
                </button>
              </div>

              <div className="flex items-center rounded border border-bfl-line focus-within:border-black">
                <span className="pl-3 text-[14px] text-bfl-grey">UGX</span>
                <input
                  id="payout-amount"
                  ref={amountRef}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  /* 16px, so focusing it on iOS does not zoom the page and
                     leave the seller pinching their way back out. */
                  className="w-full bg-transparent px-2 py-2.5 text-[16px] font-semibold text-black focus:outline-none"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                />
              </div>

              {tooMuch ? (
                <p className="mt-1.5 text-[13px] font-semibold text-shop-sale">
                  You can withdraw up to {formatPrice(overview.payable)} right now.
                </p>
              ) : tooLittle ? (
                <p className="mt-1.5 text-[13px] font-semibold text-shop-sale">
                  The smallest payout we send is {formatPrice(overview.minimum)}.
                </p>
              ) : (
                <p className="mt-1.5 text-[13px] text-bfl-grey">
                  Between {formatPrice(overview.minimum)} and {formatPrice(overview.payable)}.
                  Payouts settle whole orders, so we may send slightly less than you type and leave
                  the rest on your balance.
                </p>
              )}
            </div>
          </fieldset>

          {error && (
            <p
              role="alert"
              className="mt-4 border-l-2 border-shop-sale bg-[#fdeeeb] px-3 py-2 text-[14px] text-shop-sale"
            >
              {error}
            </p>
          )}

          <p className="mt-5 rounded bg-bfl-surface px-3 py-2.5 text-[13px] text-[#333]">
            We process every request within <strong>24 hours</strong>. You will get an email now
            confirming it, and another the moment the money goes out.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="flex-1 rounded border border-bfl-line px-4 py-3 text-[14px] font-semibold text-[#333] transition-colors hover:border-[#b0b0b0] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={invalid || sending}
              className="flex-[2] rounded border border-black bg-black px-4 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Sending your request…" : `Request ${formatPrice(value || 0)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
