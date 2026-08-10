import { cookies } from "next/headers";

/**
 * Server-side plumbing for the owner's product manager.
 *
 * The browser never holds the shared API secret and never talks to WordPress
 * directly: it calls /api/owner/*, and this module attaches both credentials
 * server-side — the shared secret from the environment, the owner passcode from
 * an httpOnly cookie the browser cannot read.
 */

/** Name of the httpOnly cookie holding the owner passcode. */
export const OWNER_COOKIE = "kandi_owner_passcode";

/** Cache tag on every product read, so a write can invalidate the storefront. */
export const PRODUCTS_TAG = "kandi-products";

export function ownerApiBase(): string {
  const url = process.env.WP_API_URL;
  if (!url) {
    throw new Error(
      "WP_API_URL is not set. Add it to .env.local, e.g. WP_API_URL=https://yourwordpresssite.com/wp-json/kandi/v1"
    );
  }
  return `${url.replace(/\/$/, "")}/owner`;
}

export type OwnerCallResult = {
  status: number;
  data: unknown;
};

type OwnerCallOptions = {
  method?: string;
  body?: unknown;
  search?: string;
  /**
   * Passcode to authenticate with. Omitted, it is read from the cookie — which
   * is what every call except sign-in wants.
   */
  passcode?: string;
};

/**
 * Calls a `kandi/v1/owner/*` endpoint on WordPress.
 *
 * Never throws on a transport failure: an unreachable backend comes back as a
 * 502 with a readable message, the same shape as any other error, so the admin
 * screen has one error path rather than two.
 */
export async function callOwnerApi(
  path: string,
  { method = "GET", body, search = "", passcode }: OwnerCallOptions = {}
): Promise<OwnerCallResult> {
  const credential = passcode ?? (await cookies()).get(OWNER_COOKIE)?.value;

  if (!credential) {
    return { status: 401, data: { message: "Sign in with the owner passcode to continue." } };
  }

  let response: Response;
  try {
    response = await fetch(`${ownerApiBase()}${path}${search}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
        "X-Kandi-Owner-Passcode": credential,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[kandi-owner] WordPress unreachable:", error);
    return {
      status: 502,
      data: { message: "Could not reach the store backend. Please try again." },
    };
  }

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

export async function setOwnerCookie(passcode: string) {
  (await cookies()).set(OWNER_COOKIE, passcode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearOwnerCookie() {
  (await cookies()).delete(OWNER_COOKIE);
}

/** True when the browser is carrying an owner cookie at all. */
export async function hasOwnerCookie(): Promise<boolean> {
  return Boolean((await cookies()).get(OWNER_COOKIE)?.value);
}
