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

type StartBody = {
  purpose?: { kind: "order"; orderId: number } | { kind: "seller-fee"; sellerId: number };
};

export async function POST(request: Request) {
  const base = process.env.WP_API_URL;
  if (!base) {
    return Response.json(
      { error: "The shop is not connected to its backend yet." },
      { status: 503 }
    );
  }

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
    console.error("[kandi-store] payment start: non-JSON reply", response.status, raw.slice(0, 200));
    return Response.json(
      { error: "The payment service returned something unreadable. Please try again." },
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
    return Response.json({ error: message }, { status: response.status || 502 });
  }

  return Response.json({
    redirect_url: data.redirect_url,
    order_tracking_id: data.order_tracking_id,
    merchant_reference: data.merchant_reference,
  });
}
