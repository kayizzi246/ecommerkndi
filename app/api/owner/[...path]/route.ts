import { revalidatePath, revalidateTag } from "next/cache";
import { callOwnerApi, PRODUCTS_TAG } from "@/lib/owner-server";

/**
 * Authenticated passthrough for the owner endpoints (me, products, categories).
 *
 * `/login` and `/logout` have their own route files and take precedence over
 * this catch-all.
 *
 * Anything that writes also drops the storefront's cached product reads. Those
 * reads are cached for a minute, which is why a product added or deleted here
 * used to take up to a minute to show up on the shop — the write now clears the
 * cache itself instead of waiting the window out.
 */

type Context = { params: Promise<{ path: string[] }> };

const ALLOWED_ROOTS = new Set(["me", "products", "categories"]);

async function proxy(request: Request, context: Context, method: string) {
  const { path } = await context.params;

  if (path.length === 0 || !ALLOWED_ROOTS.has(path[0])) {
    return Response.json({ message: "Unknown owner endpoint." }, { status: 404 });
  }

  const body =
    method === "GET" || method === "DELETE"
      ? undefined
      : await request.json().catch(() => ({}));

  const { search } = new URL(request.url);

  const { status, data } = await callOwnerApi(`/${path.join("/")}`, {
    method,
    body,
    search,
  });

  if (method !== "GET" && status >= 200 && status < 300) {
    // `{ expire: 0 }` rather than the recommended "max": stale-while-revalidate
    // would hand the next visitor the old catalogue once more, and the whole
    // point of this call is that the owner can open the shop straight after
    // saving and see the change. Expiring outright makes that read block on
    // fresh data instead.
    revalidateTag(PRODUCTS_TAG, { expire: 0 });
    // The homepage and listing pages are prerendered, so dropping the fetch
    // cache alone would still serve the old HTML until the page itself expired.
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
