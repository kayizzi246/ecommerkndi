import { settlePesapalPayment } from "@/lib/pesapal-settle";
import { clientIp, enforceRateLimit, MONEY_LIMITS } from "@/lib/rate-limit";

/**
 * Whether a payment the mobile app started has gone through yet.
 *
 * ---- Why the app needs this and the website does not ----
 *
 * On the web, Pesapal sends the shopper back to `/payment/callback`, which is a
 * page on this origin: it settles the payment server-side while the shopper is
 * looking at it, and the shopper never leaves the shop.
 *
 * The app has no such return trip. It opens Pesapal in the phone's browser —
 * an external application — and the shopper finishes paying somewhere the app
 * cannot see. When they switch back, the app knows only that it once opened a
 * URL. Something has to answer "did that work?", and this is it.
 *
 * ---- It settles; it does not merely report ----
 *
 * This calls the SAME `settlePesapalPayment` the web callback and the IPN both
 * call. That matters more than it looks: settling is what marks the WooCommerce
 * order paid, and routing the app through a different path would give the shop
 * two ways for an order to become paid that could drift apart. There is one
 * way, and all three entry points use it.
 *
 * It is therefore safe to poll and safe to call twice. The status is always
 * fetched from Pesapal rather than taken from anything the caller said, so a
 * request cannot mark its own order paid, and settling an already-settled
 * payment is a no-op.
 *
 * ---- Public, like the rest of `/api/app/*` ----
 *
 * No shared secret. The only input is an `order_tracking_id`, which Pesapal
 * issued and which this endpoint hands straight back to Pesapal to ask about.
 * Guessing one buys nothing: the answer is a boolean about somebody else's
 * order, and the settling it triggers is the outcome Pesapal already decided.
 *
 * ---- Public, but not free ----
 *
 * "Guessing a tracking id buys nothing" is about CONFIDENTIALITY, and it holds.
 * It says nothing about cost, and this endpoint is expensive: every call makes
 * the server ask Pesapal for a status and then, on a paid one, ask WordPress to
 * settle it. Unthrottled, a loop here spends the shop's Pesapal quota and
 * WordPress's capacity for as long as it likes, from anywhere, with no
 * credential at all.
 *
 * So it is rate limited by source address, at a ceiling set from what the app
 * actually does. The app polls while the shopper is away paying — every few
 * seconds for a minute or two — and `MONEY_LIMITS.paymentStatus` clears that
 * comfortably. A shopper who somehow exhausts it loses nothing: the IPN settles
 * the order server-to-server whether or not anybody is polling.
 */

export async function POST(request: Request) {
  const throttled = await enforceRateLimit(
    "payment-status",
    clientIp(request),
    MONEY_LIMITS.paymentStatus
  );
  if (throttled) return throttled;

  let body: { order_tracking_id?: string; merchant_reference?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const trackingId = (body.order_tracking_id ?? "").trim();
  if (!trackingId) {
    return Response.json(
      { error: "No payment to check." },
      { status: 400 }
    );
  }

  try {
    const result = await settlePesapalPayment(
      trackingId,
      body.merchant_reference?.trim() || undefined
    );

    return Response.json({
      paid: result.paid,
      /**
       * Pesapal's own wording when a payment fails — "Insufficient balance",
       * "Cancelled by user". Passed through rather than replaced with a generic
       * sentence, because it is usually the only thing that tells the shopper
       * what to do differently.
       */
      description: result.description,
      paymentMethod: result.paymentMethod,
      orderId: result.purpose?.kind === "order" ? result.purpose.orderId : null,
    });
  } catch (error) {
    console.error("[kandi-store] app payment status failed:", error);
    /**
     * 200, not 502, and deliberately so.
     *
     * The app polls this. A failure here means "we could not reach Pesapal just
     * now", which is not the same as "the payment failed" — and an app that
     * treats an unreachable status check as a failed payment would tell a
     * shopper whose money has left their account that it had not. `paid: false`
     * with `pending: true` says keep waiting, which is the truth.
     *
     * The IPN settles the order independently of this endpoint, so a payment is
     * never lost because polling could not confirm it.
     */
    return Response.json({
      paid: false,
      pending: true,
      description:
        "We could not reach the payment service just now. If money left your account, your order is safe.",
      paymentMethod: "",
      orderId: null,
    });
  }
}
