import { settlePesapalPayment } from "@/lib/pesapal-settle";
import CallbackBridge from "./CallbackBridge";

export const metadata = {
  title: "Confirming payment",
  robots: { index: false, follow: false },
};

/**
 * Where Pesapal returns the shopper after they pay.
 *
 * This page loads *inside the payment iframe*, so it is not a destination —
 * its whole job is to establish the real outcome and tell the page hosting the
 * iframe what happened, which then closes the modal and moves the shopper on.
 *
 * The status is fetched from Pesapal here on the server rather than read from
 * the URL. Pesapal deliberately omits the payment status from the callback, so
 * that nobody can mark their own order paid by editing a query string.
 *
 * The same settle path runs from the IPN, so an order is recorded even if this
 * page never loads. Both are idempotent.
 */
export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const orderTrackingId = first("OrderTrackingId");
  const merchantReference = first("OrderMerchantReference");
  const cancelled = first("cancelled");

  if (cancelled || !orderTrackingId) {
    return (
      <Shell title="Payment cancelled" tone="muted">
        <CallbackBridge
          result={{ paid: false, cancelled: true, message: "You cancelled the payment." }}
        />
        <p>No money has left your account. You can close this and try again.</p>
      </Shell>
    );
  }

  let paid = false;
  let message = "We could not confirm your payment.";
  let orderId: number | null = null;

  try {
    const result = await settlePesapalPayment(orderTrackingId, merchantReference);
    paid = result.paid;
    message = result.paid
      ? `Payment received via ${result.paymentMethod}.`
      : result.description;
    if (result.purpose?.kind === "order") orderId = result.purpose.orderId;
  } catch (error) {
    console.error("[kandi-store] payment callback failed:", error);
    // Not a lie and not a false promise: the IPN settles this independently, so
    // a failure here genuinely does not mean the payment was lost.
    message =
      "We could not reach the payment service just now. If money left your account, your order is safe — we will confirm it shortly.";
  }

  return (
    <Shell title={paid ? "Payment received" : "Payment not completed"} tone={paid ? "good" : "bad"}>
      <CallbackBridge result={{ paid, cancelled: false, message, orderId }} />
      <p>{message}</p>
    </Shell>
  );
}

function Shell({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "good" | "bad" | "muted";
  children: React.ReactNode;
}) {
  const colour =
    tone === "good" ? "text-shop-success" : tone === "bad" ? "text-shop-sale" : "text-shop-muted";

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className={`section-title text-[22px] ${colour}`}>{title}</h1>
      <div className="max-w-md text-[14px] text-shop-body">{children}</div>
    </main>
  );
}
