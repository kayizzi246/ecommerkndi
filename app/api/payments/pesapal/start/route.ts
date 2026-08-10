import {
  pesapalConfig,
  resolveIpnId,
  submitOrder,
  PesapalError,
} from "@/lib/pesapal";
import { buildReference, type PesapalPurpose } from "@/lib/pesapal-settle";

/**
 * Opens a Pesapal payment and hands the browser back a URL to load in an iframe.
 *
 * Takes what is being paid for — an existing WooCommerce order, or a seller's
 * registration fee — rather than a bare amount. The caller cannot name its own
 * price: for an order the total is read back from WordPress, so a tampered
 * request pays the real total or nothing.
 */

type StartBody = {
  purpose?: PesapalPurpose;
  amount?: number;
  description?: string;
  billing?: {
    email_address?: string;
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    line_1?: string;
    city?: string;
  };
};

/** The storefront's own origin, for the callback and IPN URLs. */
function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const config = pesapalConfig();
  if (!config) {
    return Response.json(
      { error: "Card and mobile money payments are not set up on this shop yet." },
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

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Payment amount is invalid." }, { status: 400 });
  }

  const origin = siteOrigin(request);

  try {
    const notificationId = await resolveIpnId(config, `${origin}/api/payments/pesapal/ipn`);
    const reference = buildReference(purpose);

    const result = await submitOrder({
      id: reference,
      // Uganda shillings. WooCommerce is the source of truth for the figure;
      // this only has to match the currency the shop actually prices in.
      currency: "UGX",
      amount,
      description:
        body.description ??
        (purpose.kind === "order" ? `KandiUg order` : `KandiUg seller registration`),
      callbackUrl: `${origin}/payment/callback`,
      cancellationUrl: `${origin}/payment/callback?cancelled=1`,
      notificationId,
      billingAddress: {
        country_code: "UG",
        ...body.billing,
      },
    });

    return Response.json({
      redirect_url: result.redirect_url,
      order_tracking_id: result.order_tracking_id,
      merchant_reference: result.merchant_reference,
    });
  } catch (error) {
    const message =
      error instanceof PesapalError
        ? error.message
        : "Could not start the payment. Please try again.";
    console.error("[kandi-store] pesapal start failed:", error);
    return Response.json({ error: message }, { status: 502 });
  }
}
