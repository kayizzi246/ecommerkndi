import { NextResponse } from "next/server";
import { quoteDelivery } from "@/lib/delivery";
import { getDeliveryRates } from "@/lib/site-settings";
import { getProduct } from "@/lib/woocommerce";
import { APP_WRITE_CORS_HEADERS, appPreflight } from "@/lib/app-api";

type IncomingItem = {
  productId: number;
  quantity: number;
  options?: Record<string, string>;
};

async function placeOrder(request: Request): Promise<Response> {
  const baseUrl = process.env.WP_API_URL?.replace(/\/$/, "");
  const secret = process.env.KANDI_API_SECRET;

  if (!baseUrl || !secret) {
    return NextResponse.json(
      { error: "Store is not configured (WP_API_URL / KANDI_API_SECRET missing)." },
      { status: 500 }
    );
  }

  let body: {
    customer?: Record<string, string>;
    items?: IncomingItem[];
    payment_method?: string;
    awaiting_payment?: boolean;
    delivery_point?: { lat: number; lng: number };
    delivery_place?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const customer = body.customer ?? {};
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }
  for (const field of ["first_name", "phone", "address_1", "city"] as const) {
    if (!customer[field]?.trim()) {
      return NextResponse.json(
        { error: `Please fill in your ${field.replace("_1", "").replace("_", " ")}.` },
        { status: 400 }
      );
    }
  }

  const line_items = items
    .map((item) => ({
      product_id: Number(item.productId),
      quantity: Math.max(1, Number(item.quantity) || 1),
      options:
        item.options && typeof item.options === "object" ? item.options : undefined,
    }))
    .filter((item) => Number.isInteger(item.product_id) && item.product_id > 0);

  if (line_items.length === 0) {
    return NextResponse.json({ error: "Cart items are invalid." }, { status: 400 });
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

    return NextResponse.json(data);
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
 */
async function lineItemsSubtotal(
  _baseUrl: string,
  items: { product_id: number; quantity: number }[]
): Promise<number> {
  const priced = await Promise.all(
    items.map(async (item) => {
      const product = await getProduct(item.product_id);
      return product ? product.price * item.quantity : 0;
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
