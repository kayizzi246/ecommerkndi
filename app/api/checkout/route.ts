import { NextResponse } from "next/server";
import { quoteDelivery } from "@/lib/delivery";
import { codZoneFor } from "@/lib/cod-zones";
import { cookies } from "next/headers";
import { normaliseUgPhone } from "@/lib/phone";
import { readVerified, VERIFIED_COOKIE } from "@/lib/otp";
import { getDeliveryRates } from "@/lib/site-settings";
import { getProduct } from "@/lib/woocommerce";
import { APP_WRITE_CORS_HEADERS, appPreflight } from "@/lib/app-api";
import { clientIp, enforceRateLimit, MONEY_LIMITS } from "@/lib/rate-limit";
import { claim, idempotencyKey, remember, replayOf } from "@/lib/idempotency";
import { verifyTurnstile } from "@/lib/turnstile";
import { mintPaymentToken, PAYMENT_TOKEN_COOKIE } from "@/lib/checkout-token";

type IncomingItem = {
  productId: number;
  quantity: number;
  /**
   * The exact WooCommerce variation being bought, when the product is variable.
   *
   * ---- The bug this field exists to close ----
   *
   * The shopper picked a size and a colour, and the order recorded neither. It
   * sent the PARENT product id plus `options: { Size: "38", Colour: "Red" }` as
   * free text, and WordPress attached that text to the line item as a note.
   * WooCommerce was never told which variation it was, so:
   *
   *   • The order was priced from the parent product. A variable product whose
   *     large size costs more was sold at the small size's price.
   *   • Stock moved on the parent, not the variation. Size 38 could be sold a
   *     hundred times while WooCommerce reported it in stock, and the shop found
   *     out when it went to pack them.
   *   • Nothing checked the combination existed. `{ Size: "999" }` was accepted
   *     and written onto the order as if it were real.
   *
   * The id is sent from the browser and then VALIDATED server-side — it must
   * belong to the parent, and it must be purchasable — so a tampered id fails
   * rather than buying something else cheaply. See `kandi-store-api.php`, which
   * does the checking, because it is the side that holds the catalogue.
   */
  variationId?: number;
  options?: Record<string, string>;
};

/* ---- Ceilings, so a request cannot ask for unbounded work ----
 *
 * None of these is reachable by a person buying clothes. They are here because
 * this endpoint creates real WooCommerce orders — a database write, a stock
 * decrement and an email each — and every one of those is work an unauthenticated
 * caller could otherwise ask for in whatever quantity they liked. A body with
 * fifty thousand line items in it costs the shop a great deal and the sender
 * nothing.
 *
 * The delivery quote makes it worse than it looks: `lineItemsSubtotal` fetches
 * every distinct product to price it, so N line items is N calls to WooCommerce
 * before a single order is written. The line cap is the one that matters most. */

/** Bytes. A hundred-line order with long addresses is nowhere near this. */
const MAX_BODY_BYTES = 64 * 1024;

/** Distinct lines. A basket is a basket, not a spreadsheet import. */
const MAX_LINE_ITEMS = 50;

/** Units of any one line. */
const MAX_QUANTITY_PER_LINE = 20;

/** Units across the whole order. */
const MAX_TOTAL_QUANTITY = 100;

/**
 * Reads the request body with a ceiling on its size.
 *
 * `request.json()` will happily buffer whatever arrives, so the check has to
 * happen before parsing rather than after. `Content-Length` is consulted first
 * because it lets an oversized request be refused without reading it at all,
 * and the length of the text is checked afterwards because that header is
 * client-supplied and a chunked request need not send one.
 */
async function readBody(request: Request): Promise<{ body: unknown } | { error: Response }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return {
      error: NextResponse.json({ error: "That order is too large." }, { status: 413 }),
    };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid request body." }, { status: 400 }),
    };
  }

  if (text.length > MAX_BODY_BYTES) {
    return {
      error: NextResponse.json({ error: "That order is too large." }, { status: 413 }),
    };
  }

  try {
    return { body: JSON.parse(text) };
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid request body." }, { status: 400 }),
    };
  }
}

async function placeOrder(request: Request): Promise<Response> {
  const baseUrl = process.env.WP_API_URL?.replace(/\/$/, "");
  const secret = process.env.KANDI_API_SECRET;

  if (!baseUrl || !secret) {
    return NextResponse.json(
      { error: "Store is not configured (WP_API_URL / KANDI_API_SECRET missing)." },
      { status: 500 }
    );
  }

  /* ---- Throttling, before anything else is read ----
   *
   * This endpoint was public and unmetered. A script could create orders as
   * fast as the network allowed, and each one is a WooCommerce write plus an
   * email — so the cost of the attack is a loop, and the cost of absorbing it
   * is the shop's hosting bill and an order book nobody can find real orders
   * in. Six per ten minutes per address is a bad day for a real shopper and a
   * wall for anything automated.
   *
   * Shared across instances when Upstash is configured — see the note on
   * `rateLimitAsync`. This is still the second line of defence: a WAF rule in
   * front of the origin stops the flood before it costs a function invocation,
   * and this stops what gets through. */
  const ip = clientIp(request);
  const throttled = await enforceRateLimit("checkout", ip, MONEY_LIMITS.checkout);
  if (throttled) return throttled;

  const read = await readBody(request);
  if ("error" in read) return read.error;

  const body = read.body as {
    customer?: Record<string, string>;
    items?: IncomingItem[];
    payment_method?: string;
    awaiting_payment?: boolean;
    delivery_point?: { lat: number; lng: number };
    delivery_place?: string;
    turnstile_token?: string;
  };

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  /* ---- Is there a person behind this ----
   *
   * Inert unless the shop has set `TURNSTILE_SECRET_KEY`; see `lib/turnstile.ts`
   * for the setup and for why it fails open when Cloudflare itself is
   * unreachable. Checked after the rate limit and before any work, because a
   * bot check that runs after the expensive part has already happened protects
   * nothing. */
  const human = await verifyTurnstile(body.turnstile_token, ip);
  if (!human.ok) {
    console.warn("[kandi-store] checkout turnstile rejected:", human.reason);
    return NextResponse.json(
      {
        error: "We could not confirm you are a person. Please reload the page and try again.",
        code: "turnstile_failed",
      },
      { status: 403 }
    );
  }

  /* ---- The same order, sent twice ----
   *
   * A stalled connection on a mobile network, a double tap, a browser retrying
   * a POST — see `lib/idempotency.ts`. Any of them creates two identical orders
   * that the shop packs, charges for, and discovers a week later.
   *
   * The key is the client's, one per checkout ATTEMPT. If it names an attempt
   * already answered, that answer is returned again and nothing new is created.
   * If it names one in flight, the second request is told so rather than racing
   * the first. */
  const idempotency = idempotencyKey(request);

  if (idempotency) {
    const previous = await replayOf("checkout", idempotency);
    if (previous !== undefined) return NextResponse.json(previous);

    if (!(await claim("checkout", idempotency))) {
      return NextResponse.json(
        {
          error: "That order is already being placed. Give it a moment before trying again.",
          code: "in_progress",
        },
        { status: 409 }
      );
    }
  }

  const customer = body.customer ?? {};
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }
  if (items.length > MAX_LINE_ITEMS) {
    return NextResponse.json(
      { error: `An order can hold at most ${MAX_LINE_ITEMS} different items.` },
      { status: 400 }
    );
  }
  for (const field of ["first_name", "phone", "address_1", "city"] as const) {
    if (!customer[field]?.trim()) {
      return NextResponse.json(
        { error: `Please fill in your ${field.replace("_1", "").replace("_", " ")}.` },
        { status: 400 }
      );
    }
  }

  /* ---- The phone number, checked rather than collected ----
   *
   * Every order here is finished by a rider on the phone, so a number that
   * cannot be called is an order that cannot be delivered — and the shop finds
   * out only after it has packed and dispatched it. The browser checks the same
   * rule with the same function; this is the copy that anyone posting straight
   * to this endpoint cannot skip.
   *
   * Normalised, not merely validated: the order stores `+2567XXXXXXXX` whether
   * it was typed as 0772…, 256772… or +256 772…, so two orders from the same
   * person are recognisably from the same person. */
  const phone = normaliseUgPhone(customer.phone ?? "");
  if (!phone) {
    return NextResponse.json(
      {
        error:
          "That phone number does not look right. Enter a Ugandan mobile number — " +
          "07XX XXX XXX — because the rider calls it to deliver your order.",
      },
      { status: 400 }
    );
  }
  customer.phone = phone;

  /* ---- The server half of the checkout verification gate ----
   *
   * `CheckoutVerifyGate` puts a one-time-code dialog in front of this page for
   * any browser that has never proved a contact. This is the half that a
   * shopper cannot delete from the DOM.
   *
   * ---- Why it is scoped to same-origin requests ----
   *
   * This endpoint has two callers. One is the storefront, which is a browser on
   * this domain and carries the sealed cookie. The other is the Kandi phone
   * app, which is cross-origin — that is what `APP_WRITE_CORS_HEADERS` exists
   * for — and has no cookie jar at all. Requiring the cookie unconditionally
   * would take every app order down the moment this shipped.
   *
   * `Sec-Fetch-Site` is the discriminator. It is a forbidden header name, so a
   * page script cannot set or remove it: on a request from our own storefront
   * the browser writes `same-origin` and no amount of tampering in the console
   * changes that. The app's request does not carry it.
   *
   * ---- What this does and does not stop ----
   *
   * It stops the realistic bypass, which is a person who opens dev tools,
   * deletes the modal and submits the form underneath it. It does NOT stop a
   * script posting straight to this URL with no `Sec-Fetch-Site` header, and
   * pretending otherwise would be worse than the gap: anything that wants to
   * place unverified orders from outside a browser still can, and the controls
   * that actually bound that are the rate limiter above, the Turnstile check,
   * and the fact that an order still has to survive a rider ringing the number.
   *
   * The escape hatch is deliberate and it is for one situation: a shop whose
   * SMS gateway is down and which would rather take unverified orders than take
   * none. It defaults to enforcing.
   */
  const enforceVerification =
    process.env.KANDI_REQUIRE_VERIFIED_CHECKOUT !== "0" &&
    request.headers.get("sec-fetch-site") === "same-origin";

  if (enforceVerification) {
    const proved = await readVerified((await cookies()).get(VERIFIED_COOKIE)?.value);
    if (!proved) {
      return NextResponse.json(
        {
          error:
            "Please verify your phone number before placing this order. " +
            "Reload the page and enter the 6-digit code we send you.",
          /* A code the browser can act on rather than only a sentence. The
             checkout catches it and reopens the dialog, so a shopper whose
             cookie expired mid-order is one code away from finishing rather
             than reading an error and leaving. */
          code: "verification_required",
        },
        { status: 403 }
      );
    }
  }

  /* ---- Cash on delivery is a place, not a preference ----
   *
   * COD is offered in a few neighbourhoods and nowhere else; `lib/cod-zones.ts`
   * carries the list and the reasoning. This is the check that ENFORCES it. The
   * checkout hides and disables the option outside those areas, which is the
   * courtesy; a hidden radio is not a rule, because the order that matters is
   * the one posted by a script, a stale tab, or a shopper who picked COD in
   * Kololo and then moved the pin to Mukono before submitting.
   *
   * It is read off the delivery COORDINATE — the same point delivery is priced
   * from — rather than the typed city, so it cannot be typed around and cannot
   * disagree with the fee. No point means no COD at all: an order with no
   * location has nothing to check the rule against, and quietly allowing it
   * would make the whole rule optional. */
  const codRequested = (body.payment_method ?? "").toLowerCase() === "cod";
  const codZone = codRequested ? codZoneFor(body.delivery_point) : null;

  if (codRequested && !codZone) {
    return NextResponse.json(
      {
        error:
          "Cash on delivery is not available in your area. " +
          "Please pay by mobile money or card — your cart is saved.",
        code: "cod_unavailable",
      },
      { status: 400 }
    );
  }

  const line_items = items
    .map((item) => ({
      product_id: Number(item.productId),
      // Clamped, not merely coerced. `quantity: 999999` used to reach
      // WooCommerce as-is, which is a stock decrement and an invoice total that
      // nobody intended and a backorder the shop cannot fill.
      quantity: Math.min(
        MAX_QUANTITY_PER_LINE,
        Math.max(1, Math.floor(Number(item.quantity)) || 1)
      ),
      // Forwarded for WordPress to check against the parent. Zero and rubbish
      // are dropped here so the backend sees either a plausible id or nothing.
      variation_id:
        Number.isInteger(Number(item.variationId)) && Number(item.variationId) > 0
          ? Number(item.variationId)
          : undefined,
      options:
        item.options && typeof item.options === "object" ? item.options : undefined,
    }))
    .filter((item) => Number.isInteger(item.product_id) && item.product_id > 0);

  if (line_items.length === 0) {
    return NextResponse.json({ error: "Cart items are invalid." }, { status: 400 });
  }

  const totalQuantity = line_items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity > MAX_TOTAL_QUANTITY) {
    return NextResponse.json(
      {
        error:
          `That is more than ${MAX_TOTAL_QUANTITY} items. ` +
          "For an order that size, please contact us directly.",
      },
      { status: 400 }
    );
  }

  // Delivery is priced here, on the server, from the coordinates the browser
  // sent — never from a figure it sent. The checkout showed the shopper a quote
  // from the same function against the same rates, so the two agree; but if the
  // request were tampered with, this is the number that reaches the order.
  //
  // The subtotal comes from WooCommerce's own line items rather than the cart,
  // for the same reason prices do.
  let shipping: { total: number; label: string } | undefined;

  if (body.delivery_point) {
    try {
      const rates = await getDeliveryRates();
      const subtotal = await lineItemsSubtotal(baseUrl, line_items);
      const quote = quoteDelivery(body.delivery_point, subtotal, rates);

      if (!quote.deliverable) {
        return NextResponse.json(
          { error: "We do not deliver that far yet." },
          { status: 400 }
        );
      }

      shipping = {
        total: quote.fee,
        label: quote.free
          ? "Free delivery"
          : `Delivery — ${body.delivery_place ?? quote.label}`,
      };
    } catch (error) {
      console.error("[kandi-store] delivery pricing failed:", error);
      return NextResponse.json(
        { error: "Could not work out delivery for that address. Please try again." },
        { status: 502 }
      );
    }
  }

  try {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kandi-Secret": secret,
      },
      body: JSON.stringify({
        customer,
        line_items,
        shipping,
        delivery_point: body.delivery_point,
        // Card and mobile money both settle through Pesapal; the label is what
        // shows on the order in wp-admin before payment confirms and overwrites
        // it with the method Pesapal actually reports.
        payment_method:
          body.payment_method === "card"
            ? "Card (Pesapal)"
            : body.payment_method === "mobile"
              ? "Mobile money (Pesapal)"
              : "cod",
        // Creates the order `pending` rather than `processing`, so an unpaid
        // order is visible in wp-admin instead of looking like a real sale.
        awaiting_payment: Boolean(body.awaiting_payment),
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        (data && (data.message as string)) ||
        "The store could not accept your order. Please try again.";
      return NextResponse.json({ error: message }, { status: res.status >= 500 ? 502 : 400 });
    }

    /* ---- The token that lets this order be paid for ----
     *
     * `/api/payments/pesapal/start` used to take a bare order id, and order ids
     * are sequential — so anyone could open a payment against anyone else's
     * order, and the quote that came back carried that buyer's name, email,
     * phone and address. See `lib/checkout-token.ts`.
     *
     * The proof of ownership is minted here, at the only moment the server
     * knows for certain who placed the order: the request that placed it.
     *
     * It goes back two ways. In the JSON, which is the copy every payment
     * actually uses — the checkout page is about to call the payment route, and
     * the mobile app has no cookie jar worth relying on. And in an httpOnly
     * cookie, which survives a reload that the page's memory does not. */
    const orderId = Number((data as { id?: unknown })?.id);
    const paymentToken =
      Number.isInteger(orderId) && orderId > 0
        ? await mintPaymentToken({ kind: "order", orderId })
        : null;

    const payload = { ...(data as Record<string, unknown>), payment_token: paymentToken };

    // Remembered only now the order really exists, so a request that failed
    // validation can be corrected and retried under the same key.
    if (idempotency) await remember("checkout", idempotency, payload);

    const response = NextResponse.json(payload);

    if (paymentToken) {
      // Set on the response object rather than through `cookies()`, because
      // `POST` below rebuilds the response to attach the CORS headers and only
      // what is on `response.headers` survives that copy.
      response.cookies.set(PAYMENT_TOKEN_COOKIE, paymentToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        // The token's own expiry is sealed into its signature; this is just the
        // browser-side courtesy, and it is matched to it.
        maxAge: 60 * 60,
      });
    }

    return response;
  } catch (error) {
    console.error("[kandi-store] order submission failed:", error);
    return NextResponse.json(
      { error: "Could not reach the store. Please try again shortly." },
      { status: 502 }
    );
  }
}

/**
 * The order's subtotal, priced from WooCommerce rather than from the cart.
 *
 * Needed only to decide whether the order clears the free-delivery threshold,
 * and that decision must not be settleable by editing a number in the browser.
 *
 * ---- Deduplicated, which is a throttle as much as an optimisation ----
 *
 * It used to fetch once per line item, so an order with the same product on
 * twenty lines made twenty identical calls to WooCommerce before a single order
 * was written. With a cap of fifty lines that is fifty upstream requests per
 * checkout attempt, which is the sort of amplification that turns a rate limit
 * on this endpoint into a rate limit that is still too generous. Distinct
 * products are fetched once each and the quantities summed against them.
 */
async function lineItemsSubtotal(
  _baseUrl: string,
  items: { product_id: number; quantity: number }[]
): Promise<number> {
  const quantities = new Map<number, number>();
  for (const item of items) {
    quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
  }

  const priced = await Promise.all(
    [...quantities].map(async ([productId, quantity]) => {
      const product = await getProduct(productId);
      return product ? product.price * quantity : 0;
    })
  );

  return priced.reduce((sum, value) => sum + value, 0);
}

/**
 * ---- The exported handlers ----
 *
 * The work is `placeOrder` above; these two exist so that the checkout can be called
 * from a browser-hosted build of the app.
 *
 * `OPTIONS` answers the preflight the browser sends before any cross-origin
 * POST carrying `Content-Type: application/json`, and `POST` copies the same
 * permission onto the real answer — a preflight that passes and a response with
 * no `Access-Control-Allow-Origin` on it still fails, and fails looking exactly
 * like a network error. The reasoning behind opening these up at all is on
 * `APP_WRITE_CORS_HEADERS`.
 *
 * The headers are added to a COPY of the response rather than being threaded
 * through every `return` inside — there are a dozen of them and one forgotten
 * on an error path is a bug nobody sees until an order fails.
 */
export function OPTIONS(): Response {
  return appPreflight();
}

export async function POST(request: Request): Promise<Response> {
  const response = await placeOrder(request);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(APP_WRITE_CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
