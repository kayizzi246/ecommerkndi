import { settlePesapalPayment } from "@/lib/pesapal-settle";
import { clientIp, rateLimitAsync, MONEY_LIMITS } from "@/lib/rate-limit";
import { claim } from "@/lib/idempotency";

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

/**
 * The shape Pesapal's tracking ids actually have: a UUID.
 *
 * Checked because this endpoint is, by necessity, open to the whole internet —
 * a payment provider cannot present a credential we chose — and everything it
 * receives is fed to an outbound request. Refusing anything that is not the
 * right shape turns "send arbitrary strings and make the shop go and ask
 * Pesapal about each one" into a check that costs nothing and never leaves the
 * process. It is not authentication; it is the cheap half of not being used as
 * a request amplifier.
 *
 * The real authentication is downstream and unchanged: `settlePesapalPayment`
 * asks PESAPAL what happened rather than believing this payload, so a forged
 * notification cannot mark anything paid.
 */
const TRACKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(request: Request, payload: IpnPayload) {
  const orderTrackingId = (payload.OrderTrackingId ?? "").trim();
  const merchantReference = (payload.OrderMerchantReference ?? "").trim().slice(0, 128);
  const notificationType = (payload.OrderNotificationType ?? "IPNCHANGE").slice(0, 64);

  const envelope = {
    orderNotificationType: notificationType,
    orderTrackingId,
    orderMerchantReference: merchantReference,
  };

  if (!TRACKING_ID.test(orderTrackingId)) {
    // 500 in the envelope is "received but not processed". Pesapal will retry a
    // genuine notification; a caller sending junk gets the same answer and
    // learns nothing from it.
    return Response.json({ ...envelope, status: 500 }, { status: 200 });
  }

  /* ---- A ceiling, without lying to Pesapal ----
   *
   * A real 429 would be the wrong answer here: Pesapal reads the JSON envelope,
   * not the HTTP status, and an unexpected status is how a notification gets
   * abandoned rather than retried. So an over-limit caller gets the ordinary
   * "received but not processed" envelope, which asks a genuine sender to try
   * again shortly and gives an abusive one nothing.
   *
   * The limit is loose — this is a payment provider on a busy afternoon, not a
   * shopper — and keyed on source address, so a flood from one place cannot
   * crowd out real notifications from Pesapal's own hosts. */
  const throttle = await rateLimitAsync("pesapal-ipn", clientIp(request), MONEY_LIMITS.ipn);
  if (!throttle.ok) {
    console.warn("[kandi-store] pesapal IPN rate limited:", clientIp(request));
    return Response.json({ ...envelope, status: 500 }, { status: 200 });
  }

  /* ---- One settlement at a time per payment ----
   *
   * Pesapal sends the same notification more than once by design, and the web
   * callback and the app's status poll can both be settling the same payment at
   * the same moment. `settlePesapalPayment` is written to be safe to call twice,
   * but "safe" is not "free": each concurrent copy is a round trip to Pesapal
   * and another to WordPress, and duplicates arriving together are exactly how
   * an order gets two payment notes on it.
   *
   * The lock collapses them. Losing it is not an error — it means somebody else
   * is settling this very payment right now — so the answer is the ordinary
   * success envelope rather than a retry request. */
  if (!(await claim("pesapal-ipn", orderTrackingId))) {
    return Response.json({ ...envelope, status: 200 }, { status: 200 });
  }

  try {
    await settlePesapalPayment(orderTrackingId, merchantReference || undefined);
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
  return handle(request, payload);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return handle(request, {
    OrderNotificationType: params.get("OrderNotificationType") ?? undefined,
    OrderTrackingId: params.get("OrderTrackingId") ?? undefined,
    OrderMerchantReference: params.get("OrderMerchantReference") ?? undefined,
  });
}
