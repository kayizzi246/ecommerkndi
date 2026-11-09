// =============================================================================
//  woo-sync: WooCommerce -> Supabase
//
//  Called only by the WordPress plugin kandi-supabase-sync.php, authenticated
//  with the shared secret in the `x-kandi-secret` header (Supabase secret
//  KANDI_SYNC_SECRET; the same value goes into the plugin's settings).
//
//  Body, one of:
//    { type: "products",        products: [ ...kandi_format_product rows ] }
//    { type: "delete_products", ids: [123, 456] }
//    { type: "categories",      categories: [ {id, name, slug, parent, count, image} ], replace: true }
//    { type: "order_status",    woo_order_id: 123, status: "completed", total?: 98000 }
//
//  Deploy with JWT verification OFF (WordPress has no Supabase login):
//    supabase functions deploy woo-sync --no-verify-jwt
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Constant-time comparison, so a wrong secret leaks nothing about the right one. */
function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const num = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const decode = (text: unknown) =>
  String(text ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&#8217;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"');

// deno-lint-ignore no-explicit-any
function productRow(p: any) {
  const categories = Array.isArray(p.categories) ? p.categories : [];
  return {
    id: num(p.id),
    name: decode(p.name),
    slug: p.slug ?? null,
    price: num(p.price),
    regular_price: num(p.regular_price) || num(p.price),
    sale_price: p.sale_price === null || p.sale_price === undefined ? null : num(p.sale_price),
    on_sale: Boolean(p.on_sale),
    featured: Boolean(p.featured),
    stock_status: String(p.stock_status ?? "instock"),
    stock_quantity: p.stock_quantity === null || p.stock_quantity === undefined ? null : num(p.stock_quantity),
    image: p.image || null,
    gallery: Array.isArray(p.gallery) ? p.gallery : [],
    // deno-lint-ignore no-explicit-any
    categories: categories.map((c: any) => ({ id: num(c.id), name: decode(c.name), slug: c.slug })),
    // deno-lint-ignore no-explicit-any
    category_ids: categories.map((c: any) => num(c.id)).filter((id: number) => id > 0),
    attributes: Array.isArray(p.attributes) ? p.attributes : [],
    variations: Array.isArray(p.variations) ? p.variations : [],
    short_description: p.short_description ?? null,
    description: p.description ?? null,
    average_rating: num(p.average_rating),
    rating_count: num(p.rating_count),
    total_sales: num(p.total_sales),
    date_created: p.date_created || null,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST only." }, 405);

  const expected = Deno.env.get("KANDI_SYNC_SECRET") ?? "";
  if (!sameSecret(request.headers.get("x-kandi-secret") ?? "", expected)) {
    return json({ error: "Invalid secret." }, 403);
  }

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  switch (body?.type) {
    case "products": {
      const rows = (Array.isArray(body.products) ? body.products : [])
        .map(productRow)
        .filter((row: { id: number }) => row.id > 0);
      if (rows.length === 0) return json({ ok: true, upserted: 0 });
      const { error } = await supabase.from("products").upsert(rows, { onConflict: "id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, upserted: rows.length });
    }

    case "delete_products": {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map((id: unknown) => num(id)).filter((id: number) => id > 0);
      if (ids.length === 0) return json({ ok: true, deleted: 0 });
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, deleted: ids.length });
    }

    case "categories": {
      // deno-lint-ignore no-explicit-any
      const rows = (Array.isArray(body.categories) ? body.categories : []).map((c: any) => ({
        id: num(c.id),
        name: decode(c.name),
        slug: String(c.slug ?? ""),
        parent: num(c.parent),
        count: num(c.count),
        image: c.image || null,
        synced_at: new Date().toISOString(),
      })).filter((row: { id: number; slug: string }) => row.id > 0 && row.slug);

      if (rows.length > 0) {
        const { error } = await supabase.from("categories").upsert(rows, { onConflict: "id" });
        if (error) return json({ error: error.message }, 500);
      }
      // A full list replaces what is there: categories deleted in WordPress go.
      if (body.replace && rows.length > 0) {
        const keep = rows.map((row: { id: number }) => row.id);
        await supabase.from("categories").delete().not("id", "in", `(${keep.join(",")})`);
      }
      return json({ ok: true, upserted: rows.length });
    }

    case "order_status": {
      const wooId = num(body.woo_order_id);
      const status = String(body.status ?? "").replace(/^wc-/, "");
      if (!wooId || !status) return json({ error: "woo_order_id and status are required." }, 400);

      const patch: Record<string, unknown> = { status };
      if (body.total !== undefined) patch.total = num(body.total);

      const { data, error } = await supabase
        .from("orders")
        .update(patch)
        .eq("woo_order_id", wooId)
        .select("id");
      if (error) return json({ error: error.message }, 500);
      // Orders placed on the website have no app copy; nothing to update is fine.
      return json({ ok: true, updated: data?.length ?? 0 });
    }

    default:
      return json({ error: "Unknown type." }, 400);
  }
});
