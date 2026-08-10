import { getTransactionStatus, isPaid } from "@/lib/pesapal";

/**
 * Turning a Pesapal payment into a settled order or a paid seller fee.
 *
 * Shared by the shopper's callback page and the server-to-server IPN, because
 * both must do exactly the same thing: neither carries the payment status, so
 * both fetch it, and either may arrive first. Everything here is idempotent —
 * WordPress refuses to pay an order twice and returns `already: true`.
 */

/** What our merchant reference encodes, so a callback knows what it settled. */
export type PesapalPurpose =
  | { kind: "order"; orderId: number }
  | { kind: "seller-fee"; sellerId: number };

/**
 * References are round-tripped through Pesapal, which only accepts
 * alphanumerics and `. _ - :`. Encoding the purpose in the reference itself
 * means the IPN needs no database of its own to know what it is confirming.
 */
export function buildReference(purpose: PesapalPurpose): string {
  const suffix = Date.now().toString(36);
  return purpose.kind === "order"
    ? `ORD-${purpose.orderId}-${suffix}`
    : `SEL-${purpose.sellerId}-${suffix}`;
}

export function parseReference(reference: string): PesapalPurpose | null {
  const match = /^(ORD|SEL)-(\d+)-/.exec(reference);
  if (!match) return null;

  const id = Number(match[2]);
  if (!Number.isInteger(id) || id <= 0) return null;

  return match[1] === "ORD"
    ? { kind: "order", orderId: id }
    : { kind: "seller-fee", sellerId: id };
}

function wpBase(): string {
  const url = process.env.WP_API_URL;
  if (!url) throw new Error("WP_API_URL is not set.");
  return url.replace(/\/$/, "");
}

async function callWordPress(path: string, body: unknown) {
  const response = await fetch(`${wpBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (data as { message?: string } | null)?.message ?? `WordPress rejected the update (${response.status}).`
    );
  }
  return data;
}

export type SettleResult = {
  paid: boolean;
  purpose: PesapalPurpose | null;
  /** Pesapal's own wording, shown to the shopper when a payment fails. */
  description: string;
  paymentMethod: string;
};

/**
 * Fetches the real status from Pesapal and records the outcome in WordPress.
 *
 * The status is always fetched, never taken from the callback URL: Pesapal
 * deliberately omits it from both the callback and the IPN so that a shopper
 * cannot mark their own order paid by editing a query string.
 */
export async function settlePesapalPayment(
  orderTrackingId: string,
  merchantReferenceHint?: string
): Promise<SettleResult> {
  const status = await getTransactionStatus(orderTrackingId);

  const reference = status.merchant_reference ?? merchantReferenceHint ?? "";
  const purpose = parseReference(reference);
  const paymentMethod = status.payment_method ?? "Pesapal";
  const description =
    status.description ?? status.payment_status_description ?? "Payment was not completed.";

  if (!purpose) {
    return { paid: false, purpose: null, description: "Unknown payment reference.", paymentMethod };
  }

  if (!isPaid(status)) {
    // Only an order gets a failure recorded. A seller who abandons the fee just
    // stays unpaid, which is already the correct state.
    if (purpose.kind === "order") {
      await callWordPress(`/orders/${purpose.orderId}/payment-failed`, { reason: description });
    }
    return { paid: false, purpose, description, paymentMethod };
  }

  if (purpose.kind === "order") {
    await callWordPress(`/orders/${purpose.orderId}/payment`, {
      transaction_id: status.confirmation_code ?? orderTrackingId,
      payment_method: paymentMethod,
      payment_account: status.payment_account ?? "",
    });
  } else {
    await callWordPress(`/seller/fee-paid`, {
      seller_id: purpose.sellerId,
      transaction_id: status.confirmation_code ?? orderTrackingId,
      payment_method: paymentMethod,
    });
  }

  return { paid: true, purpose, description, paymentMethod };
}
