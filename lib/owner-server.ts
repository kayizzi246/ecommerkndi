import { cookies } from "next/headers";
import { seal, unseal, SESSION_TTL_SECONDS } from "@/lib/sealed-cookie";

/**
 * Server-side plumbing for the owner's product manager.
 *
 * The browser never holds the shared API secret and never talks to WordPress
 * directly: it calls /api/owner/*, and this module attaches both credentials
 * server-side — the shared secret from the environment, the owner passcode
 * recovered from an httpOnly, encrypted cookie the browser can neither read nor
 * write.
 */

/**
 * Name of the httpOnly cookie holding the owner's session.
 *
 * ---- Renamed, and why the old name is worth a paragraph ----
 *
 * It was `kandi_owner_passcode`, and the name was accurate: the cookie held the
 * owner passcode in plaintext, for thirty days. It now holds AES-GCM ciphertext
 * with a twelve-hour expiry sealed inside it — see `lib/sealed-cookie.ts` for
 * what that buys and what it does not.
 *
 * The name changed with the contents rather than staying put, for two reasons.
 * A cookie called `…_passcode` invites the next person to read it as one and
 * hand it around. And an old plaintext cookie left in a browser will simply
 * fail to unseal, so every existing session ends at the next request and the
 * owner signs in once — which is the correct outcome for a credential that has
 * been sitting in plaintext and should now be considered exposed.
 */
export const OWNER_COOKIE = "kandi_owner_session";

/**
 * The name the cookie used to have.
 *
 * Kept only so it can be actively deleted on sign-in and sign-out. Left alone,
 * a browser carrying the old cookie would keep the plaintext passcode on disk
 * indefinitely — nothing would read it, but nothing would remove it either, and
 * "the credential is still on the device, just unused" is not a fix.
 */
const LEGACY_OWNER_COOKIE = "kandi_owner_passcode";

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
  // Either the passcode being tested at sign-in, or the one sealed inside the
  // session cookie. `unseal` returns null for a cookie that was tampered with,
  // sealed under a rotated secret, or has simply expired — all three mean the
  // same thing to the caller, and all three end up as the 401 below.
  const credential = passcode ?? (await unseal((await cookies()).get(OWNER_COOKIE)?.value));

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

/**
 * Starts an owner session.
 *
 * Returns false when the passcode could not be sealed, which happens only if
 * neither `KANDI_SESSION_SECRET` nor `KANDI_API_SECRET` is set — a server that
 * cannot talk to WordPress at all. The caller must treat that as a failed
 * sign-in: writing the passcode in plaintext as a fallback is the exact thing
 * this replaced.
 */
export async function setOwnerCookie(passcode: string): Promise<boolean> {
  const sealed = await seal(passcode);
  if (!sealed) return false;

  const jar = await cookies();

  jar.set(OWNER_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Matched to the expiry sealed inside the value rather than guessed at.
    // The cookie's own lifetime is a courtesy to a well-behaved browser; the
    // sealed one is the rule.
    maxAge: SESSION_TTL_SECONDS,
  });

  jar.delete(LEGACY_OWNER_COOKIE);
  return true;
}

export async function clearOwnerCookie() {
  const jar = await cookies();
  jar.delete(OWNER_COOKIE);
  jar.delete(LEGACY_OWNER_COOKIE);
}

/**
 * True when the browser is carrying an owner cookie at all.
 *
 * Presence only — this says nothing about whether the value is a real session,
 * because anyone can send any cookie they like. `httpOnly` stops *scripts in
 * the page* from reading the cookie; it does not stop a client from inventing
 * one, and `curl -H 'Cookie: kandi_owner_session=x'` will set this to true all
 * day. Such a value will not decrypt, so it buys nothing beyond making this
 * function say yes.
 *
 * Use it only to decide whether it is worth asking WordPress. To decide whether
 * somebody is actually the owner, use {@link isOwnerAuthenticated}.
 */
export async function hasOwnerCookie(): Promise<boolean> {
  return Boolean((await cookies()).get(OWNER_COOKIE)?.value);
}

/**
 * True when the cookie holds a passcode WordPress accepts.
 *
 * This exists because `hasOwnerCookie` was being used as an authorisation check
 * on `/api/revalidate`, and presence is not authorisation. Any unauthenticated
 * client could send an arbitrary cookie value and trigger a full cache purge —
 * `revalidateTag` plus `revalidatePath("/", "layout")` — as often as it liked,
 * which is precisely the "make a site rebuild itself on demand until it falls
 * over" case that route's own comment set out to prevent.
 *
 * The check costs one call to WordPress, which is why the cheap presence test
 * runs first: an anonymous request with no cookie is refused without troubling
 * the backend at all.
 */
export async function isOwnerAuthenticated(): Promise<boolean> {
  if (!(await hasOwnerCookie())) return false;

  const { status } = await callOwnerApi("/me");
  return status === 200;
}
