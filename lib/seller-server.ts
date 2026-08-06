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
  { method = "GET", body, authenticated = true, search = "" }: WpCallOptions = {}
): Promise<WpCallResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
  };

  if (authenticated) {
    const token = (await cookies()).get(SELLER_COOKIE)?.value;
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
