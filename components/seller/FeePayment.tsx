"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/currency";
import PesapalModal from "@/components/PesapalModal";
import type { Seller } from "@/lib/seller";
import { useSellerSession } from "@/lib/seller-session";

/**
 * The joining-fee panel.
 *
 * Lives here rather than inside the sign-up flow because two screens need it:
 * the confirmation at the end of registration, and the setup gate that stands
 * between an unpaid seller and their dashboard. One copy means the payment
 * reference, the manual-transfer fallback and the Pesapal handling cannot drift
 * apart between the two places a seller might pay from.
 */
export default function FeePayment({
  seller,
  registrationFee,
  payNumber,
  payName,
}: {
  seller: Seller;
  registrationFee: number;
  payNumber: string;
  payName: string;
}) {
  const amount = seller.fee_amount || registrationFee;
  const { refresh } = useSellerSession();
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPayment = async () => {
    setStarting(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/pesapal/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: { kind: "seller-fee", sellerId: seller.id },
          amount,
          description: `KandiUg seller joining fee — ${seller.store_name}`.slice(0, 100),
          billing: {
            email_address: seller.email,
            phone_number: seller.phone,
            first_name: seller.owner_name,
          },
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.redirect_url) {
        setError(data?.error ?? "Could not open the payment window. Please try again.");
        return;
      }

      setPaymentUrl(data.redirect_url);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  };

  if (paid) {
    return (
      <div className="mt-7 rounded-2xl border-2 border-pop-green bg-pop-green-soft p-6 text-left">
        <p className="text-[15px] font-semibold text-pop-green">Joining fee paid</p>
        <p className="mt-1 text-[14px] leading-relaxed text-shop-body">
          Thank you. Your application goes to our team for approval — you can sign in and start
          adding products in the meantime.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7 rounded-2xl border-2 border-shop-flame bg-shop-primary-soft p-6 text-left">
      <p className="text-[14px] font-semibold uppercase tracking-wide text-shop-primary">
        Next: pay the joining fee
      </p>
      <p className="price mt-1 text-[22px] leading-none text-shop-flame">{formatPrice(amount)}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={startPayment}
          disabled={starting}
          className="btn-shop flex-1 py-3 text-[15px]"
        >
          {starting ? "Opening…" : "Pay by mobile money"}
        </button>
        <button
          type="button"
          onClick={startPayment}
          disabled={starting}
          className="btn-shop-outline flex-1 py-3 text-[15px]"
        >
          Pay by card
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13.5px] font-medium text-shop-sale">
          {error}
        </p>
      )}

      <details className="mt-5">
        <summary className="cursor-pointer text-[13.5px] font-semibold text-shop-body hover:text-shop-primary">
          Rather send the money yourself?
        </summary>
        <dl className="mt-3 space-y-2.5 text-[15px]">
          {payNumber ? (
            <>
              <Row label="Send to" value={payNumber} />
              {payName && <Row label="Registered name" value={payName} />}
            </>
          ) : (
            <p className="text-shop-body">
              Call us on the number in your approval email and we will confirm how to pay.
            </p>
          )}
          <Row label="Your reference" value={seller.fee_reference} mono />
        </dl>
        <p className="mt-3 text-[13.5px] leading-relaxed text-shop-body">
          Quote that reference so we can match your payment to your store. We confirm it by email,
          usually the same day.
        </p>
      </details>

      <PesapalModal
        url={paymentUrl}
        title={`Pay ${formatPrice(amount)}`}
        onClose={() => setPaymentUrl(null)}
        onDone={async (outcome) => {
          setPaymentUrl(null);
          if (outcome.paid) {
            setPaid(true);
            /**
             * Pull the seller again so the gate opens by itself.
             *
             * By the time this fires, the callback page has already settled the
             * payment server-side and WordPress has `fee_status = paid` — but
             * this browser is still holding the seller it loaded before paying,
             * where the fee was outstanding. Without this the seller is shown
             * "Joining fee paid" by one component while another goes on
             * blocking their dashboard over the very same fee, and the only way
             * through is the "I have paid — check again" button underneath.
             *
             * That button stays, for the case where the IPN is the thing that
             * settles it and arrives a moment late.
             */
            await refresh().catch(() => undefined);
          } else {
            setError(
              outcome.cancelled
                ? "You cancelled the payment. You can pay whenever you are ready."
                : outcome.message || "The payment did not go through. Please try again."
            );
          }
        }}
      />
    </div>
  );
}

/** One label/value line in the manual-payment details. */
function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-shop-primary/15 pb-2">
      <dt className="text-shop-body">{label}</dt>
      <dd className={`font-semibold text-shop-ink ${mono ? "font-mono tracking-wide" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
