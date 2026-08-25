/**
 * Opens a payment and hands the browser back a URL to load in the frame.
 *
 * This used to call Pesapal directly from here. It no longer does: on this
 * shop's hosting the function died before it could answer — Cloudflare returned
 * a bare `502` with no body, the shopper was told only that the payment window
 * would not open, and there was no log anywhere to say why. Serverless
 * functions there run on a short leash behind a proxy, which makes a payment
 * both fragile and undiagnosable.
 *
 * WordPress does the talking now. It is an ordinary PHP process with no
 * execution ceiling and a log file you can read, it holds the WooCommerce order
 * the payment is for, and Pesapal's IPN calls it directly instead of routing
 * through a function that may be asleep.
 *
 * What is left here is a proxy: it attaches the shared secret, forwards the
 * purpose, and passes the answer back. It never sees the Pesapal keys.
 */

import { cookies } from "next/headers";
import { pesapalConfig, resolveIpnId, submitOrder, type BillingAddress } from "@/lib/pesapal";
import {
  PAYMENT_TOKEN_COOKIE,
  paymentTokensEnforced,
  verifyPaymentToken,
  type PaymentPurpose,
} from "@/lib/checkout-token";
import { callSellerApi } from "@/lib/seller-server";
import { clientIp, enforceRateLimit, MONEY_LIMITS } from "@/lib/rate-limit";

type StartBody = {
  purpose?: PaymentPurpose;
  /**
   * Proof that the caller is the person who placed the order.
   *
   * Minted by `/api/checkout` at the moment the order was created and handed
   * back in that response; see `lib/checkout-token.ts` for why an order id on
   * its own was not enough.
   */
  token?: string;
};

/**
 * Decides whether this caller is allowed to open a payment for this purpose.
 *
 * ---- What was wrong before ----
 *
 * Nothing was checked. The body named an order id, the route forwarded it, and
 * WordPress answered with what was owed — including that order's billing block:
 * the buyer's name, email address, phone number and street. WooCommerce order
 * ids are sequential integers, so a loop from 1 upwards walked the customer
 * list, and every iteration also opened a live Pesapal session against somebody
 * else's order.
 *
 * ---- The two kinds of proof ----
 *
 * An ORDER is proved by the token minted when it was placed. That is the only
 * moment the server knows who the buyer is — checkout is deliberately open to
 * shoppers with no account, so there is no session to bind to instead. The
 * token travels in the JSON response (which the checkout page and the mobile
 * app hold) and in an httpOnly cookie (which survives a reload, so the "pay
 * now" button on the order-received page still works).
 *
 * A SELLER FEE is proved by the seller's own session. The seller is by
 * definition signed in, so the strong check is available and is used: the id in
 * the request must be the id WordPress says this token belongs to. Without
 * this, one seller could pay under another's id, or read their fee and store
 * details out of the quote.
 */
async function authorise(
  purpose: PaymentPurpose,
  tokenFromBody: string | undefined
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (purpose.kind === "seller-fee") {
    const { status, data } = await callSellerApi("/session");
    const session = data as { checked?: boolean; seller?: { id?: number } };

    // `checked` is set only by the authenticated handler on WordPress — see the
    // note on `sellerApi.me` in `lib/seller.ts` for the duplicate-route incident
    // that made this flag necessary. A 200 without it is somebody else
    // answering on that path, and is not identity.
    if (status !== 200 || !session?.checked || session.seller?.id !== purpose.sellerId) {
      return {
        ok: false,
        response: Response.json(
          { error: "Sign in to your seller account to pay this fee." },
          { status: 401 }
        ),
      };
    }

    return { ok: true };
  }

  if (!paymentTokensEnforced()) {
    // No key to verify with means no shop either — nothing here can reach
    // WordPress without `KANDI_API_SECRET`. Refusing loudly beats a payment
    // route that quietly stops checking who is asking.
    console.error(
      "[kandi-store] cannot verify payment tokens — set KANDI_CHECKOUT_SECRET " +
        "(or KANDI_API_SECRET) in the environment."
    );
    return {
      ok: false,
      response: Response.json(
        { error: "Payments are not configured on this server." },
        { status: 503 }
      ),
    };
  }

  const fromCookie = (await cookies()).get(PAYMENT_TOKEN_COOKIE)?.value;

  // Either copy will do. They are the same token by different routes, and which
  // one arrives depends on whether the shopper is still on the page that placed
  // the order or has come back to it.
  for (const candidate of [tokenFromBody, fromCookie]) {
    if (await verifyPaymentToken(candidate, purpose)) return { ok: true };
  }

  return {
    ok: false,
    response: Response.json(
      {
        error:
          "This payment link has expired. Open the order from your account and try again.",
        code: "payment_not_authorised",
      },
      { status: 403 }
    ),
  };
}

/** What WordPress says is owed. The amount never comes from the browser. */
type Quote = {
  reference: string;
  amount: number;
  currency: string;
  description: string;
  billing: BillingAddress;
  storefront: string;
};

function wpUrl(path: string): string {
  return `${(process.env.WP_API_URL ?? "").replace(/\/$/, "")}${path}`;
}

function wpHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
  };
}

/**
 * Starts the payment from here instead of from WordPress.
 *
 * WordPress is the better place to do this — it holds the order and Pesapal's
 * IPN can reach it directly — but on this shop's host the PHP process dies the
 * instant it opens an outbound HTTPS connection, so `/payments/start` returns a
 * bodiless 502 and no payment can begin. Reading an order from WordPress works
 * perfectly; only reaching *out* is broken.
 *
 * So this route splits the job along that line. WordPress is asked what is
 * owed, which it answers reliably, and the call to Pesapal is made from here,
 * where outbound requests work. The shopper's money is never at the mercy of
 * whichever half is currently healthy.
 *
 * The amount still comes from WooCommerce. That is the whole reason for asking
 * WordPress for a quote rather than letting the checkout name a figure — a
 * tampered request pays the real total or fails.
 */
async function startDirectly(purpose: PaymentPurpose) {
  const config = pesapalConfig();
  if (!config) return null;

  const quoteResponse = await fetch(wpUrl("/payments/quote"), {
    method: "POST",
    headers: wpHeaders(),
    body: JSON.stringify({
      kind: purpose.kind,
      id: purpose.kind === "order" ? purpose.orderId : purpose.sellerId,
    }),
    cache: "no-store",
  });

  const quote = (await quoteResponse.json().catch(() => null)) as Quote | null;
  if (!quoteResponse.ok || !quote?.reference || !(quote.amount > 0)) {
    return null;
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? quote.storefront ?? "").replace(/\/$/, "");

  // Pesapal's notification must land somewhere that is awake and reachable.
  // Pointed here rather than at WordPress, because a payment started from this
  // server should be confirmed by it too — the settle step then calls
  // WordPress, which is an inbound request and therefore reliable.
  const notificationId = await resolveIpnId(config, `${site}/api/payments/pesapal/ipn`);

  const result = await submitOrder({
    id: quote.reference,
    currency: quote.currency,
    amount: quote.amount,
    description: quote.description,
    callbackUrl: `${site}/payment/callback`,
    cancellationUrl: `${site}/payment/callback?cancelled=1`,
    notificationId,
    billingAddress: quote.billing ?? {},
  });

  return result.redirect_url ? result : null;
}

export async function POST(request: Request) {
  const base = process.env.WP_API_URL;
  if (!base) {
    return Response.json(
      { error: "The shop is not connected to its backend yet." },
      { status: 503 }
    );
  }

  // Every attempt that gets past `authorise` costs an outbound call to Pesapal
  // and one to WordPress. More generous than checkout, because retrying a
  // failed payment on the same order is a normal thing for a shopper to do.
  const throttled = await enforceRateLimit(
    "payment-start",
    clientIp(request),
    MONEY_LIMITS.paymentStart
  );
  if (throttled) return throttled;

  let body: StartBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const purpose = body.purpose;
  if (
    !purpose ||
    (purpose.kind === "order" && !(purpose.orderId > 0)) ||
    (purpose.kind === "seller-fee" && !(purpose.sellerId > 0))
  ) {
    return Response.json({ error: "Nothing to pay for." }, { status: 400 });
  }

  /* Who is asking, and are they entitled to this. Everything below opens a real
   * payment session and reads a real customer's billing details out of
   * WooCommerce, so this is the gate rather than an afterthought — see
   * `authorise` above for what used to be missing. */
  const allowed = await authorise(purpose, body.token);
  if (!allowed.ok) return allowed.response;

  /**
   * When this storefront holds Pesapal keys of its own, it opens the payment
   * itself and WordPress is only asked what is owed.
   *
   * WordPress is the more natural home for this — it owns the order, and
   * Pesapal's IPN can reach it without a hop. But on this shop's host, PHP dies
   * the moment it opens an outbound HTTPS connection: `/payments/start` returns
   * a bodiless 502 in under a second, every time, while the identical calls
   * succeed from here in about 250ms. Trying WordPress first would spend a
   * round trip on a failure we can already predict, on the one page where
   * hesitation costs sales.
   *
   * WordPress remains the fallback below, so if that host is ever repaired —
   * or these keys are removed — payments carry on through it untouched.
   */
  if (pesapalConfig()) {
    try {
      const direct = await startDirectly(purpose);
      if (direct) {
        return Response.json({
          redirect_url: direct.redirect_url,
          order_tracking_id: direct.order_tracking_id,
          merchant_reference: direct.merchant_reference,
        });
      }
    } catch (error) {
      console.error("[kandi-store] direct Pesapal start failed, trying WordPress:", error);
    }
  }

  // The amount is deliberately not forwarded. WordPress reads it from the order
  // or the seller's recorded fee, so a request that names its own price pays
  // the real figure or nothing.
  const payload = {
    kind: purpose.kind,
    id: purpose.kind === "order" ? purpose.orderId : purpose.sellerId,
  };

  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}/payments/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[kandi-store] payment start: WordPress unreachable:", error);
    return Response.json(
      { error: "Could not reach the store backend. Please try again." },
      { status: 502 }
    );
  }

  const raw = await response.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!data) {
    // The bodiless 502 a crashed PHP worker leaves behind. Nothing to relay,
    // and the direct route above has already had its turn.
    console.error(
      "[kandi-store] WordPress could not start the payment",
      response.status,
      raw.slice(0, 200)
    );
    return Response.json(
      {
        error: "The payment service returned something unreadable. Please try again.",
        code: "kandi_upstream_unreadable",
        upstream_status: response.status,
      },
      { status: 502 }
    );
  }

  // The plugin that owns this endpoint is not on the server yet. "No route was
  // found matching the URL" is WordPress talking to a developer, not something
  // to show somebody trying to pay for socks.
  if (data.code === "rest_no_route") {
    console.error(
      "[kandi-store] /payments/start missing on WordPress — upload " +
        "wordpress/kandi-pesapal.php and activate Kandi Pesapal."
    );
    return Response.json(
      {
        error:
          "Card and mobile money are not switched on yet. You can still choose " +
          "cash on delivery, or try again shortly.",
      },
      { status: 503 }
    );
  }

  if (!response.ok || !data.redirect_url) {
    // WordPress sends a readable sentence with every failure — a wrong key, the
    // wrong environment, Pesapal unreachable. Passing it through is the whole
    // point: the shopper, and whoever they forward the screenshot to, should be
    // able to see what actually went wrong.
    const message =
      typeof data.message === "string"
        ? data.message
        : "Could not start the payment. Please try again.";

    console.error("[kandi-store] payment start failed", response.status, data);

    // WordPress's own error slug travels with the message. Three quite
    // different faults arrive here as the same 502 — Pesapal unreachable,
    // Pesapal rejecting the keys, Pesapal returning no payment page — and
    // without the code the browser console cannot tell them apart, which is
    // how this bug stayed a mystery through several rounds of guessing.
    return Response.json(
      {
        error: message,
        code: typeof data.code === "string" ? data.code : "kandi_payment_failed",
        upstream_status: response.status,
      },
      { status: response.status || 502 }
    );
  }

  return Response.json({
    redirect_url: data.redirect_url,
    order_tracking_id: data.order_tracking_id,
    merchant_reference: data.merchant_reference,
  });
}
