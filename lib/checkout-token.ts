/**
 * The token that proves a payment belongs to the person who placed the order.
 *
 * ---- The hole this closes ----
 *
 * `/api/payments/pesapal/start` used to accept a bare order id and nothing
 * else. Order ids in WooCommerce are sequential integers, so `{"purpose":
 * {"kind":"order","orderId":1487}}` in a loop walks the whole order book. That
 * would be bad enough on its own — anyone could open a payment against anyone
 * else's order — but the quote WordPress answers with carries the buyer's
 * billing block: their name, email, phone and street address. A sequential
 * integer was, in effect, the key to the customer list.
 *
 * The fix is the ordinary one: a payment must be started by whoever placed the
 * order, and the only thing that can prove that is a secret the shopper was
 * handed at the moment they placed it.
 *
 * ---- Why a signed token and not a database row ----
 *
 * A one-time token in a table would be marginally stronger — it could be burned
 * on use — but it needs somewhere shared to live, and this storefront runs as
 * serverless functions with no shared store guaranteed to be configured. A
 * token signed with a secret only the server holds needs no storage at all and
 * cannot be forged without the key. What it gives up is single use, which
 * matters less here than it sounds: retrying a payment on the same order is a
 * thing shoppers legitimately do, and the token expires.
 *
 * ---- Shape ----
 *
 *     <payload>.<signature>
 *
 * where the payload is base64url of `{k, i, e}` — kind, id, expiry in epoch
 * seconds — and the signature is HMAC-SHA256 over the payload string. Nothing
 * in it is secret; the point is that it cannot be *written* by a client, not
 * that it cannot be read.
 *
 * ---- The key ----
 *
 * `KANDI_CHECKOUT_SECRET` if it is set, otherwise `KANDI_API_SECRET`, which
 * every deployment already has. Falling back rather than requiring a new
 * variable is what lets this ship without a configuration step that, if
 * forgotten, would take checkout down; setting the dedicated one is still
 * better practice, because a token key and a backend key should not be able to
 * compromise each other.
 */

/** How long a freshly minted token is good for. */
const TTL_SECONDS = 60 * 60;

export type PaymentPurpose =
  | { kind: "order"; orderId: number }
  | { kind: "seller-fee"; sellerId: number };

function secret(): string | null {
  return process.env.KANDI_CHECKOUT_SECRET || process.env.KANDI_API_SECRET || null;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sign(payload: string, key: string): Promise<string> {
  const imported = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    imported,
    new TextEncoder().encode(payload)
  );
  return base64url(new Uint8Array(signature));
}

/**
 * Constant-time string comparison.
 *
 * `===` on a signature leaks, through how long it takes to fail, how many
 * leading characters were right — which is enough to reconstruct a valid
 * signature one character at a time. The cost of doing it properly is one loop.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function purposeId(purpose: PaymentPurpose): number {
  return purpose.kind === "order" ? purpose.orderId : purpose.sellerId;
}

/**
 * Mints the token handed back with a newly created order.
 *
 * Returns null when no key is configured, which the caller treats as "this
 * deployment cannot issue tokens" rather than as an error — see
 * {@link paymentTokensEnforced}.
 */
export async function mintPaymentToken(purpose: PaymentPurpose): Promise<string | null> {
  const key = secret();
  if (!key) return null;

  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        k: purpose.kind,
        i: purposeId(purpose),
        e: Math.floor(Date.now() / 1000) + TTL_SECONDS,
      })
    )
  );

  return `${payload}.${await sign(payload, key)}`;
}

/**
 * Whether this deployment is able to issue and therefore to demand tokens.
 *
 * The check is deliberately in one place. A route that required a token on a
 * server that cannot mint one would refuse every payment; a route that skipped
 * the check whenever the token was missing would be no check at all. Every
 * deployment of this shop sets `KANDI_API_SECRET` — without it nothing can talk
 * to WordPress and there is no shop — so in practice this is always true, and
 * the branch exists so the failure is legible rather than mysterious.
 */
export function paymentTokensEnforced(): boolean {
  return secret() !== null;
}

/**
 * True when `token` was minted by this server for exactly this purpose and has
 * not expired.
 */
export async function verifyPaymentToken(
  token: string | undefined | null,
  purpose: PaymentPurpose
): Promise<boolean> {
  const key = secret();
  if (!key || !token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  if (!timingSafeEqual(signature, await sign(payload, key))) return false;

  const decoded = fromBase64url(payload);
  if (!decoded) return false;

  let claims: { k?: unknown; i?: unknown; e?: unknown };
  try {
    claims = JSON.parse(new TextDecoder().decode(decoded));
  } catch {
    return false;
  }

  if (claims.k !== purpose.kind) return false;
  if (claims.i !== purposeId(purpose)) return false;
  if (typeof claims.e !== "number" || claims.e < Date.now() / 1000) return false;

  return true;
}

/**
 * Name of the cookie the web checkout carries its token in.
 *
 * The browser gets the token twice. In the JSON response, which the checkout
 * page holds in memory for the payment call it makes a moment later — that is
 * the path every payment actually takes today. And in this httpOnly cookie,
 * which survives a reload, so a retry that has lost the page's memory is not
 * left with nothing.
 *
 * The cookie is the belt to the JSON's braces. Nothing in the shop reads it
 * yet; it is set now because the alternative is discovering at the worst moment
 * that a shopper who refreshed can no longer pay for the order they just
 * placed. The mobile app has no cookie jar worth relying on and uses the JSON
 * copy.
 */
export const PAYMENT_TOKEN_COOKIE = "kandi_payment_token";
