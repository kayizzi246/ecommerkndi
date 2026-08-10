import { settlePesapalPayment } from "@/lib/pesapal-settle";

/**
 * Pesapal's Instant Payment Notification endpoint.
 *
 * This is the half of the integration that makes it trustworthy. The shopper's
 * callback only fires if their browser survives the payment; this fires
 * server-to-server regardless, which covers the cases that actually lose
 * money — the connection dropping after payment, the tab being closed on the
 * Pesapal screen, or the payment being rejected minutes later.
 *
 * Registered as POST, but Pesapal may be configured either way on the merchant
 * account, so both verbs are handled.
 *
 * The reply must be the JSON envelope Pesapal expects, echoing the ids back
 * with `status: 200` for "received and processed" or `500` for "received but
 * something went wrong" — a 500 tells Pesapal to retry later, which is what we
 * want if WordPress was briefly unreachable.
 */

type IpnPayload = {
  OrderNotificationType?: string;
  OrderTrackingId?: string;
  OrderMerchantReference?: string;
};

async function handle(payload: IpnPayload) {
  const orderTrackingId = payload.OrderTrackingId ?? "";
  const merchantReference = payload.OrderMerchantReference ?? "";
  const notificationType = payload.OrderNotificationType ?? "IPNCHANGE";

  const envelope = {
    orderNotificationType: notificationType,
    orderTrackingId,
    orderMerchantReference: merchantReference,
  };

  if (!orderTrackingId) {
    return Response.json({ ...envelope, status: 500 }, { status: 200 });
  }

  try {
    await settlePesapalPayment(orderTrackingId, merchantReference);
    // 200 whether or not the payment succeeded: the *notification* was handled,
    // which is what this status reports. A failed payment is a settled outcome,
    // not a delivery failure, and telling Pesapal to retry it would be wrong.
    return Response.json({ ...envelope, status: 200 }, { status: 200 });
  } catch (error) {
    console.error("[kandi-store] pesapal IPN failed:", error);
    // 500 asks Pesapal to try again — correct when WordPress was unreachable.
    return Response.json({ ...envelope, status: 500 }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as IpnPayload;
  return handle(payload);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return handle({
    OrderNotificationType: params.get("OrderNotificationType") ?? undefined,
    OrderTrackingId: params.get("OrderTrackingId") ?? undefined,
    OrderMerchantReference: params.get("OrderMerchantReference") ?? undefined,
  });
}
