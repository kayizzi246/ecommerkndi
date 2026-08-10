import { revalidatePath, revalidateTag } from "next/cache";
import { callSellerApi } from "@/lib/seller-server";
import { PRODUCTS_TAG } from "@/lib/owner-server";

/**
 * Authenticated passthrough for every remaining Seller Centre endpoint
 * (me, stats, products, orders, commissions, payouts, settings).
 *
 * `/login`, `/logout` and `/register` are handled by their own route files and
 * take precedence over this catch-all.
 */

type Context = { params: Promise<{ path: string[] }> };

const ALLOWED_ROOTS = new Set([
  "me",
  "stats",
  "products",
  "orders",
  "commissions",
  "payouts",
  "settings",
]);

async function proxy(request: Request, context: Context, method: string) {
  const { path } = await context.params;

  if (path.length === 0 || !ALLOWED_ROOTS.has(path[0])) {
    return Response.json({ message: "Unknown seller endpoint." }, { status: 404 });
  }

  const body =
    method === "GET" || method === "DELETE"
      ? undefined
      : await request.json().catch(() => ({}));

  const { search } = new URL(request.url);

  const { status, data } = await callSellerApi(`/${path.join("/")}`, {
    method,
    body,
    search,
  });

  // A seller editing a listing changes what shoppers see, so the storefront's
  // cached product reads have to go with it — otherwise a price change sits
  // invisible behind the cache for up to a minute.
  if (method !== "GET" && path[0] === "products" && status >= 200 && status < 300) {
    revalidateTag(PRODUCTS_TAG, { expire: 0 });
    revalidatePath("/", "layout");
  }

  return Response.json(data, { status });
}

export async function GET(request: Request, context: Context) {
  return proxy(request, context, "GET");
}

export async function POST(request: Request, context: Context) {
  return proxy(request, context, "POST");
}

export async function PUT(request: Request, context: Context) {
  return proxy(request, context, "PUT");
}

export async function DELETE(request: Request, context: Context) {
  return proxy(request, context, "DELETE");
}
