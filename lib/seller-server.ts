import { cookies } from "next/headers";

/** Name of the httpOnly cookie holding the seller's WordPress session token. */
export const SELLER_COOKIE = "kandi_seller_token";

export function sellerApiBase(): string {
  const url = process.env.WP_API_URL;
  if (!url) {
    throw new Error(
      "WP_API_URL is not set. Add it to .env.local, e.g. WP_API_URL=https://yourwordpresssite.com/wp-json/kandi/v1"
    );
  }
  return `${url.replace(/\/$/, "")}/seller`;
}

type WpCallOptions = {
  method?: string;
  body?: unknown;
  /** Attach the caller's seller token as a Bearer credential. */
  authenticated?: boolean;
  search?: string;
  /**
   * Use THIS token rather than reading the session cookie.
   *
   * The website's seller session lives in an httpOnly cookie, which is the
   * right store for a browser and useless to the phone app: Dart's HTTP client
   * keeps no cookie jar, so a cookie-based sign-in succeeds and is forgotten
   * before the next request. The app therefore carries a bearer token, exactly
   * as the shopper app already does — see the note at the head of
   * `lib/app-auth.ts`.
   *
   * Passing it here is what lets `/api/app/seller/*` reuse this function
   * unchanged instead of growing a parallel copy that could drift from it.
   */
  token?: string;
};

export type WpCallResult = {
  status: number;
  data: unknown;
};

/**
 * Calls a `kandi/v1/seller/*` endpoint on WordPress. The shared secret proves
 * the request came from this storefront; the bearer token identifies the seller.
 */
export async function callSellerApi(
  path: string,
  {
    method = "GET",
    body,
    authenticated = true,
    search = "",
    token: explicitToken,
  }: WpCallOptions = {}
): Promise<WpCallResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
  };

  if (authenticated) {
    // An explicitly supplied token wins over the cookie: the caller is the app
    // route, which has no cookie to read.
    const token = explicitToken ?? (await cookies()).get(SELLER_COOKIE)?.value;
    if (!token) {
      return { status: 401, data: { message: "Your session has expired. Please sign in again." } };
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${sellerApiBase()}${path}${search}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[kandi-seller] WordPress unreachable:", error);
    return {
      status: 502,
      data: { message: "Could not reach the store backend. Please try again." },
    };
  }

  const data = await response.json().catch(() => ({}));

  /**
   * WordPress answers `rest_no_route` when the endpoint does not exist — which,
   * for this storefront, almost always means the plugin file on the server
   * predates the feature being called rather than anything being wrong with the
   * request.
   *
   * Its own wording, "No route was found matching the URL and request method",
   * is the kind of message that gets screenshotted and sent to a developer. This
   * translates it once, here, so every seller endpoint says the same useful
   * thing instead of each route having to remember to.
   */
  if ((data as { code?: string }).code === "rest_no_route") {
    console.error(
      `[kandi-seller] ${path} is missing on WordPress — upload the current ` +
        "wordpress/kandi-seller-api.php to wp-content/plugins/kandi-seller-api/."
    );
    return {
      status: 501,
      data: {
        code: "kandi_plugin_outdated",
        message:
          "This part of the Seller Centre is not switched on yet: the Kandi Seller " +
          "Centre plugin on WordPress needs updating. Ask your administrator to " +
          "re-upload it.",
      },
    };
  }

  return { status: response.status, data };
}

export async function setSellerCookie(token: string, maxAgeSeconds: number) {
  (await cookies()).set(SELLER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearSellerCookie() {
  (await cookies()).delete(SELLER_COOKIE);
}
