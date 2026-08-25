/**
 * Encrypted, expiring cookie values.
 *
 * ---- The specific thing this replaces ----
 *
 * The owner's session was the passcode itself, sitting in a cookie called
 * `kandi_owner_passcode`, valid for thirty days. `httpOnly` kept page scripts
 * from reading it, and that is genuinely most of the risk — but it is not all
 * of it, and the shape of what remained is bad:
 *
 *   • The most powerful credential on the site — a single passcode, no username
 *     to guess alongside it — was stored in plaintext on a device the shop does
 *     not control, for a month at a time.
 *   • Anything that can read the cookie jar reads the passcode itself, not a
 *     token: a stolen laptop, a browser profile copied off a machine, a backup,
 *     a support agent asked to "check the cookies". Every one of those is a
 *     permanent compromise rather than a session to revoke.
 *   • There is nothing to revoke. Because the cookie IS the passcode, the only
 *     way to end a session anywhere is to change the passcode everywhere.
 *
 * ---- What it is now ----
 *
 * The cookie holds AES-256-GCM ciphertext, keyed by a secret only the server
 * has, with an expiry sealed inside it. The browser holds something it cannot
 * read, cannot forge, and that stops working after twelve hours whatever it
 * does. The passcode still reaches WordPress on every call — that is how the
 * owner API authenticates and is not changing here — but it is recovered
 * server-side from the sealed value rather than read out of the request.
 *
 * ---- Why sealed rather than a session table ----
 *
 * A random session id in a shared store would be strictly better: it could be
 * revoked one session at a time. It also needs a store that is guaranteed to be
 * there, and this storefront runs as serverless functions where the only such
 * store is one the shop has to go and configure. Sealing needs nothing, works
 * today, and closes the plaintext-at-rest problem and the thirty-day window,
 * which are the two that actually bite. Rotating `KANDI_SESSION_SECRET`
 * invalidates every session at once, which is a coarse revocation but a real
 * one.
 *
 * ---- The key ----
 *
 * `KANDI_SESSION_SECRET` if set, otherwise `KANDI_API_SECRET`, which every
 * deployment already has. The fallback is what lets this ship without a
 * configuration step that, if missed, would lock the owner out of their own
 * shop; setting the dedicated variable is still better, because two secrets
 * that cannot compromise each other are worth having.
 */

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;

/** How long a sealed value stays valid. A working day, not a working month. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

function secretMaterial(): string | null {
  return process.env.KANDI_SESSION_SECRET || process.env.KANDI_API_SECRET || null;
}

/**
 * A 256-bit key from whatever length of secret the environment happens to hold.
 *
 * SHA-256 of the secret rather than the raw bytes, because AES-256 needs
 * exactly 32 bytes and an operator's secret is whatever they typed. This is a
 * key-derivation shortcut, not a password hash — the input is a
 * high-entropy server secret, not something guessable, so there is nothing for
 * a slow KDF to buy here.
 */
async function key(): Promise<CryptoKey | null> {
  const material = secretMaterial();
  if (!material) return null;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", digest, ALGORITHM, false, ["encrypt", "decrypt"]);
}

function toBase64url(bytes: Uint8Array): string {
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

/**
 * Encrypts `value` with an expiry stamped inside the ciphertext.
 *
 * The expiry is sealed rather than carried alongside so it cannot be edited: a
 * `maxAge` on the cookie is a request to the browser, and a browser under
 * someone else's control can decline it. Returns null when no secret is
 * configured, which the caller must treat as a failure to sign in rather than
 * as permission to fall back to plaintext.
 */
export async function seal(value: string, ttlSeconds = SESSION_TTL_SECONDS): Promise<string | null> {
  const cryptoKey = await key();
  if (!cryptoKey) return null;

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const payload = JSON.stringify({
    v: value,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  });

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    cryptoKey,
    new TextEncoder().encode(payload)
  );

  // IV in front of the ciphertext, which is the ordinary convention: it is not
  // secret, it only has to be unique per encryption, and keeping the two
  // together means one cookie rather than two that could be mixed up.
  const sealed = new Uint8Array(iv.length + ciphertext.byteLength);
  sealed.set(iv, 0);
  sealed.set(new Uint8Array(ciphertext), iv.length);

  return toBase64url(sealed);
}

/**
 * Recovers a sealed value, or null if it was tampered with, encrypted under a
 * different secret, or has expired.
 *
 * Every failure returns the same null. GCM's authentication tag means a
 * modified ciphertext throws rather than decrypting to something wrong, so
 * "somebody edited this cookie" and "this cookie is from before a secret
 * rotation" are indistinguishable here — and both mean the same thing to the
 * caller: sign in again.
 */
export async function unseal(sealed: string | undefined | null): Promise<string | null> {
  const cryptoKey = await key();
  if (!cryptoKey || !sealed) return null;

  const bytes = fromBase64url(sealed);
  if (!bytes || bytes.length <= IV_BYTES) return null;

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: bytes.slice(0, IV_BYTES) },
      cryptoKey,
      bytes.slice(IV_BYTES)
    );

    const claims = JSON.parse(new TextDecoder().decode(plaintext)) as {
      v?: unknown;
      e?: unknown;
    };

    if (typeof claims.v !== "string") return null;
    if (typeof claims.e !== "number" || claims.e < Date.now() / 1000) return null;

    return claims.v;
  } catch {
    return null;
  }
}
