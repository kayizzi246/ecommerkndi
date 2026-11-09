// =============================================================================
//  place-order: the app's checkout, Supabase -> WooCommerce
//
//  Called by the app with the shopper's Supabase session (Authorization header).
//  The order is created in WooCommerce through the same kandi/v1/orders
//  endpoint the website uses, so prices, stock checks, the delivery line, cash
//  on delivery and Pesapal all behave exactly as they do on the website. A copy
//  is kept in public.orders for the app's order history and rewards.
//
//  Body:
//    {
//      items: [{ product_id, variation_id?, quantity, options? }],
//      address_id: "uuid",
//      payment_method: "cod" | "pesapal",
//      redeem_points?: 250,
//      notes?: "Call when you are at the gate"
//    }
//
//  Returns:
//    { order_id, woo_order_id, status, total, delivery_fee, discount,
//      points_redeemed, payment_token? }
//  For "pesapal" the app passes payment_token to the website's
//  /api/payments/pesapal/start, exactly as the website checkout does.
//
//  Secrets (Supabase > Edge Functions > Secrets):
//    KANDI_WP_API_URL       https://<wordpress>/wp-json/kandi/v1
//    KANDI_API_SECRET       the same value as the website's KANDI_API_SECRET
//    KANDI_SITE_URL         https://kandiug.com
//    KANDI_CHECKOUT_SECRET  the website's KANDI_CHECKOUT_SECRET (or, if the
//                           website does not set one, its KANDI_API_SECRET)
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const service = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const WP_API = (Deno.env.get("KANDI_WP_API_URL") ?? "").replace(/\/$/, "");
const API_SECRET = Deno.env.get("KANDI_API_SECRET") ?? "";
const SITE = (Deno.env.get("KANDI_SITE_URL") ?? "https://kandiug.com").replace(/\/$/, "");
const CHECKOUT_SECRET = Deno.env.get("KANDI_CHECKOUT_SECRET") || API_SECRET;

/** Cash on delivery: within this radius of central Kampala (lib/cod-zones.ts). */
const COD_CENTRE = { lat: 0.3476, lng: 32.5825 };
const COD_RADIUS_KM = 40;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/* ---- The website's payment token (lib/checkout-token.ts), minted here ---- */

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function paymentToken(orderId: number): Promise<string | null> {
  if (!CHECKOUT_SECRET) return null;
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({ k: "order", i: orderId, e: Math.floor(Date.now() / 1000) + 3600 }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CHECKOUT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

const asPhone = (raw: string) => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("256")) return `+${digits}`;
  if (digits.startsWith("0")) return `+256${digits.slice(1)}`;
  return `+${digits}`;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "POST only." }, 405);
  if (!WP_API || !API_SECRET) return json({ error: "The shop is not configured yet." }, 500);

  /* ---- Who is ordering ---- */
  const jwt = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await service.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "Please sign in to place your order." }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const paymentMethod = body.payment_method === "pesapal" ? "pesapal" : "cod";
  const lines = (Array.isArray(body.items) ? body.items : [])
    // deno-lint-ignore no-explicit-any
    .map((item: any) => ({
      product_id: Math.trunc(Number(item.product_id)),
      variation_id: Math.trunc(Number(item.variation_id)) || 0,
      quantity: Math.min(20, Math.max(1, Math.trunc(Number(item.quantity)) || 1)),
      options: item.options && typeof item.options === "object" ? item.options : {},
    }))
    .filter((line: { product_id: number }) => line.product_id > 0)
    .slice(0, 50);
  if (lines.length === 0) return json({ error: "Your cart is empty." }, 400);

  /* ---- The catalogue, as it stands now ---- */
  const { data: products } = await service
    .from("products")
    .select("id, name, image, price, stock_status, variations")
    .in("id", lines.map((line: { product_id: number }) => line.product_id));
  const byId = new Map((products ?? []).map((product) => [Number(product.id), product]));

  let subtotal = 0;
  const snapshot = [];
  for (const line of lines) {
    const product = byId.get(line.product_id);
    if (!product || product.stock_status === "outofstock") {
      return json({ error: `${product?.name ?? "An item in your cart"} is no longer available.` }, 409);
    }
    const variations = Array.isArray(product.variations) ? product.variations : [];
    let price = Number(product.price) || 0;
    let image = product.image;
    if (variations.length > 0) {
      // deno-lint-ignore no-explicit-any
      const variation = variations.find((v: any) => Number(v.id) === line.variation_id);
      if (!variation) return json({ error: `Choose a size or colour for ${product.name}.` }, 400);
      if (variation.is_in_stock === false) {
        return json({ error: `That option of ${product.name} is sold out.` }, 409);
      }
      price = Number(variation.price) || price;
      image = variation.image || image;
    }
    subtotal += price * line.quantity;
    snapshot.push({ ...line, name: product.name, image, price });
  }

  /* ---- Where it is going ---- */
  const { data: address } = await service
    .from("addresses")
    .select("*")
    .eq("id", body.address_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!address) return json({ error: "Choose a delivery address." }, 400);

  const hasPoint = Number.isFinite(address.lat) && Number.isFinite(address.lng) && address.lat !== null;
  // deno-lint-ignore no-explicit-any
  let quote: any = null;
  try {
    const response = await fetch(`${SITE}/api/delivery/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        hasPoint
          ? { subtotal, point: { lat: address.lat, lng: address.lng } }
          : { subtotal, address: [address.street, address.area, address.city].filter(Boolean).join(", ") },
      ),
    });
    quote = await response.json();
  } catch {
    quote = null;
  }
  if (!quote || typeof quote.fee !== "number") {
    return json({ error: "We could not price delivery to that address. Check it and try again." }, 422);
  }
  if (quote.deliverable === false) return json({ error: "We do not deliver to that address yet." }, 422);

  const point = hasPoint
    ? { lat: Number(address.lat), lng: Number(address.lng) }
    : quote.point && Number.isFinite(quote.point.lat) ? quote.point : null;

  if (paymentMethod === "cod" && (!point || distanceKm(COD_CENTRE, point) > COD_RADIUS_KM)) {
    return json({
      error: "Cash on delivery is available within 40 km of central Kampala. Please pay with Mobile Money or card.",
    }, 422);
  }

  /* ---- Points ---- */
  const [{ data: settings }, { data: profile }] = await Promise.all([
    service.from("reward_settings").select("*").eq("id", 1).maybeSingle(),
    service.from("profiles").select("points_balance, full_name").eq("id", user.id).maybeSingle(),
  ]);
  const pointValue = Number(settings?.point_value_ugx ?? 10);
  const maxByPercent = Math.floor((subtotal * Number(settings?.max_redeem_percent ?? 50)) / 100 / Math.max(pointValue, 1));
  let redeem = Math.max(0, Math.trunc(Number(body.redeem_points) || 0));
  redeem = Math.min(redeem, Number(profile?.points_balance ?? 0), maxByPercent);
  if (redeem < Number(settings?.min_redeem_points ?? 100)) redeem = 0;
  const discount = redeem * pointValue;

  /* ---- The app's copy, first, so points have an order to belong to ---- */
  const { data: order, error: insertError } = await service
    .from("orders")
    .insert({
      user_id: user.id,
      status: "creating",
      payment_method: paymentMethod,
      items: snapshot,
      subtotal,
      delivery_fee: quote.fee,
      discount,
      total: Math.max(0, subtotal + quote.fee - discount),
      address,
    })
    .select("id")
    .single();
  if (insertError || !order) return json({ error: "Could not start your order. Please try again." }, 500);

  if (redeem > 0) {
    const { error: ledgerError } = await service.from("points_ledger").insert({
      user_id: user.id,
      order_id: order.id,
      delta: -redeem,
      reason: "redeemed",
      note: "Used at checkout",
    });
    if (ledgerError) {
      await service.from("orders").update({ status: "failed", error: "Not enough points" }).eq("id", order.id);
      return json({ error: "You do not have enough points for that. Refresh and try again." }, 409);
    }
    await service.from("orders").update({ points_redeemed: redeem }).eq("id", order.id);
  }

  /* ---- The real order, in WooCommerce ---- */
  const name = String(address.recipient || profile?.full_name || "Kandi customer").trim();
  const [firstName, ...rest] = name.split(/\s+/);

  // deno-lint-ignore no-explicit-any
  let woo: any = null;
  let wooStatus = 0;
  try {
    const response = await fetch(`${WP_API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Kandi-Secret": API_SECRET },
      body: JSON.stringify({
        customer: {
          first_name: firstName,
          last_name: rest.join(" "),
          phone: asPhone(address.phone || user.phone || ""),
          address_1: [address.street, address.landmark].filter(Boolean).join(", "),
          address_2: address.area ?? "",
          city: address.city,
          country: "UG",
          notes: String(body.notes ?? "").slice(0, 500),
        },
        line_items: lines.map((line: { product_id: number; variation_id: number; quantity: number; options: unknown }) => ({
          product_id: line.product_id,
          variation_id: line.variation_id || undefined,
          quantity: line.quantity,
          options: line.options,
        })),
        payment_method: paymentMethod,
        awaiting_payment: paymentMethod === "pesapal",
        shipping: { label: `Delivery (${quote.label ?? "Kandi"})`, total: quote.fee },
        delivery_point: point,
        discount: discount > 0 ? { label: `Kandi points (${redeem})`, amount: discount } : undefined,
        app_order_id: order.id,
      }),
    });
    wooStatus = response.status;
    woo = await response.json().catch(() => null);
  } catch {
    woo = null;
  }

  if (wooStatus < 200 || wooStatus >= 300 || !woo?.id) {
    const message = woo?.message ?? "The shop could not take your order right now.";
    // Moving to "failed" gives back any points that were spent (database trigger).
    await service.from("orders").update({ status: "failed", error: String(message) }).eq("id", order.id);
    return json({ error: message }, wooStatus >= 400 && wooStatus < 500 ? 409 : 502);
  }

  await service
    .from("orders")
    .update({ woo_order_id: woo.id, status: woo.status, total: Number(woo.total) || undefined })
    .eq("id", order.id);

  return json({
    order_id: order.id,
    woo_order_id: woo.id,
    status: woo.status,
    total: Number(woo.total),
    delivery_fee: quote.fee,
    discount,
    points_redeemed: redeem,
    payment_token: paymentMethod === "pesapal" ? await paymentToken(Number(woo.id)) : undefined,
  });
});
