import { NextResponse } from "next/server";

type IncomingItem = {
  productId: number;
  quantity: number;
  options?: Record<string, string>;
};

export async function POST(request: Request) {
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
