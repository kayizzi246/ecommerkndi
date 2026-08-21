import { cookies } from "next/headers";

/** httpOnly cookie holding the shopper's WordPress session token. */
export const CUSTOMER_COOKIE = "kandi_customer_token";

function apiBase(): string {
  const url = process.env.WP_API_URL;
  if (!url) {
    throw new Error("WP_API_URL is not set. Add it to .env.local.");
  }
  return url.replace(/\/$/, "");
}

type CallOptions = {
  method?: string;
  body?: unknown;
  authenticated?: boolean;
  /**
   * A bearer token supplied by the caller, instead of read from the cookie.
   *
   * The phone app has no cookie jar. It holds the WordPress token itself and
   * sends it as an `Authorization` header, so the routes under
   * `/api/app/auth/*` pass it through here rather than going via
   * `cookies()` — which on those requests would find nothing and answer 401 to
   * a shopper who is perfectly well signed in.
   *
   * When set, the cookie is not consulted at all. When absent, behaviour is
   * exactly what it was.
   */
  token?: string;
};

/** Calls a `kandi/v1/customers/*` endpoint with the shared secret attached. */
export async function callCustomerApi(
  path: string,
  options: CallOptions = {}
): Promise<{ status: number; data: unknown }> {
  return callKandiApi(`/customers${path}`, options);
}

/**
 * Calls any `kandi/v1/*` endpoint, attaching the shared secret and — unless
 * `authenticated` is switched off — the shopper's bearer token. Reviews are
 * written through here, so WordPress can attribute them to a real account.
 */
export async function callKandiApi(
  path: string,
  { method = "GET", body, authenticated = true, token }: CallOptions = {}
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
  };

  if (authenticated) {
    // The caller's token wins over the cookie. A browser request carries no
    // `token` and behaves as before; an app request carries one and never
    // touches `cookies()`.
    const bearer = token ?? (await cookies()).get(CUSTOMER_COOKIE)?.value;
    if (!bearer) {
      return { status: 401, data: { message: "Not signed in." } };
    }
    headers.Authorization = `Bearer ${bearer}`;
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[kandi-customer] WordPress unreachable:", error);
    return { status: 502, data: { message: "Could not reach the store backend." } };
  }

  return { status: response.status, data: await response.json().catch(() => ({})) };
}

export async function setCustomerCookie(token: string, maxAgeSeconds: number) {
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearCustomerCookie() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}
