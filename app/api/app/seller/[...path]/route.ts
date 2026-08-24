import { callSellerApi } from "@/lib/seller-server";
import { appAuthJson, appBearerToken } from "@/lib/app-auth";
import { appPreflight } from "@/lib/app-api";

/**
 * Authenticated passthrough to the Seller Centre, for the phone app.
 *
 * The app twin of `/api/seller/[...path]`. Identical allow-list, identical
 * upstream call — the single difference is where the credential comes from:
 * that route reads the httpOnly session cookie, this one reads the
 * `Authorization: Bearer` header the app was handed at
 * `/api/app/seller/login`. See the note there for why the app cannot use the
 * cookie.
 *
 * `/login` has its own route file, which takes precedence over this catch-all.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ path: string[] }> };

/**
 * What the app is allowed to reach.
 *
 * Deliberately a copy of the website's list rather than an import of it. These
 * two surfaces are allowed to diverge — the app may well never need
 * `settings` — and an allow-list shared between them would quietly widen this
 * one the day somebody adds an endpoint for the desktop dashboard.
 *
 * It is an ALLOW-list, not a block-list, so a new WordPress endpoint is
 * unreachable from the phone until somebody names it here on purpose.
 */
const ALLOWED_ROOTS = new Set([
  "me",
  "stats",
  "products",
  "orders",
  "commissions",
  "payouts",
]);

export function OPTIONS() {
  return appPreflight();
}

async function proxy(request: Request, context: Context, method: string) {
  const token = appBearerToken(request);
  if (!token) {
    return appAuthJson({ message: "Sign in to your seller account." }, 401);
  }

  const { path } = await context.params;
  if (path.length === 0 || !ALLOWED_ROOTS.has(path[0])) {
    return appAuthJson({ message: "Unknown seller endpoint." }, 404);
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
    // The bearer token stands in for the cookie this function would otherwise
    // reach for. Everything else about the upstream call — the shared secret,
    // the base URL, the error shapes — is unchanged, which is the point of
    // reusing it rather than writing a second caller.
    token,
  });

  return appAuthJson(data, status);
}

export const GET = (request: Request, context: Context) =>
  proxy(request, context, "GET");
export const POST = (request: Request, context: Context) =>
  proxy(request, context, "POST");
export const PUT = (request: Request, context: Context) =>
  proxy(request, context, "PUT");
export const DELETE = (request: Request, context: Context) =>
  proxy(request, context, "DELETE");
