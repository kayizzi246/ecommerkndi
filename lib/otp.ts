import { seal, unseal } from "@/lib/sealed-cookie";
import { normaliseUgPhone } from "@/lib/phone";

/**
 * One-time codes, for proving that a phone number or an email address belongs
 * to the person typing it.
 *
 * ---- What this is protecting ----
 *
 * Every order on this shop is completed by a rider ringing the number on it,
 * and most of them are cash on delivery — the shop packs the goods, pays a
 * rider, and sends them across Kampala on the strength of a phone number typed
 * into a form by somebody who has paid nothing. A number with a typo in it is a
 * wasted trip. A number typed deliberately wrong is a wasted trip the shop
 * cannot even chase.
 *
 * `lib/phone.ts` already checks that a number is SHAPED like a Ugandan mobile.
 * This checks that somebody is holding it.
 *
 * ---- Why the challenge is sealed rather than stored ----
 *
 * The obvious build puts the code in a table keyed by phone number. This
 * storefront runs as serverless functions with no database of its own —
 * WordPress is the only durable store and it is a network call away — so a
 * table means either a round trip per attempt or a new dependency to configure
 * before the feature works at all.
 *
 * `lib/sealed-cookie.ts` already solves it. The challenge is AES-256-GCM
 * ciphertext with its own expiry sealed inside, handed to the browser and
 * played back on the verify call. The browser holds something it cannot read
 * and cannot forge, the server holds nothing, and the code stops working after
 * ten minutes whatever the client does with the cookie's `maxAge`.
 *
 * The one thing a sealed challenge cannot do is COUNT. A client that keeps the
 * token can retry a code against it forever, because there is nowhere to record
 * that they have already tried nine. That is what the rate limiter is for at
 * the call sites: attempts are capped per source and per destination, which is
 * the same defence the sign-in endpoints already rely on and is shared across
 * instances wherever Upstash is configured. A six-digit code with ten attempts
 * per ten minutes is a 1-in-100,000 proposition per window; the limiter is
 * doing the arithmetic here, not the token.
 *
 * ---- The verified-contact cookie ----
 *
 * Once a code checks out, the destination is sealed into a long-lived cookie.
 * That is what makes this a ONE-TIME cost for a shopper rather than a toll
 * booth: the gate in front of checkout asks whether this browser has ever
 * proved a contact, not whether it did so today. The cookie is `httpOnly` and
 * sealed, so a shopper cannot write themselves a verified marker, and rotating
 * `KANDI_SESSION_SECRET` invalidates every one of them at once.
 */

/** How long a shopper has to type the code in. */
export const CHALLENGE_TTL_SECONDS = 10 * 60;

/**
 * How long a proved contact stays proved. Ninety days.
 *
 * The number is a judgement about what this check is FOR. It is not a session
 * — the shopper's account handles that — it is evidence that this browser
 * reached a real phone once. Making it short would re-charge the shop an SMS
 * every few weeks for a fact that has not changed, and re-charge the shopper
 * thirty seconds at the worst possible moment, which is the checkout they came
 * to complete.
 */
export const VERIFIED_TTL_SECONDS = 90 * 24 * 60 * 60;

/** The cookie holding a sealed, already-proved phone number or email address. */
export const VERIFIED_COOKIE = "kandi_verified_contact";

export type Channel = "sms" | "email";

/** A destination this shop is willing to send a code to. */
export type Destination = { channel: Channel; value: string };

/**
 * Cleans up and checks a destination, or explains why it is not one.
 *
 * Phone numbers go through `normaliseUgPhone`, so `0772 123 456`,
 * `+256772123456` and `256772123456` are one destination rather than three —
 * which matters because the rate limits below are keyed on the result.
 */
export function parseDestination(
  channel: unknown,
  raw: unknown
): { ok: true; destination: Destination } | { ok: false; message: string } {
  const value = typeof raw === "string" ? raw.trim() : "";

  if (channel === "sms") {
    const phone = normaliseUgPhone(value);
    if (!phone) {
      return {
        ok: false,
        message: "Enter a Ugandan mobile number, like 0772 123 456.",
      };
    }
    return { ok: true, destination: { channel: "sms", value: phone } };
  }

  if (channel === "email") {
    // Deliberately loose. The only test that means anything about an address is
    // whether a message sent to it arrives, and that is exactly what the next
    // step does — a stricter pattern here would only reject the unusual-but-real
    // addresses that a regex writer did not think of.
    const email = value.toLowerCase();
    if (email.length < 5 || email.length > 200 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
      return { ok: false, message: "Enter an email address we can send the code to." };
    }
    return { ok: true, destination: { channel: "email", value: email } };
  }

  return { ok: false, message: "Choose a phone number or an email address." };
}

/**
 * Six digits, from the platform CSPRNG.
 *
 * `Math.random()` is the wrong tool and it is worth saying why rather than
 * relying on the reader knowing: V8's generator is seeded per context and its
 * output is predictable from a handful of observed values. An attacker who can
 * request codes for their own number can observe as many as they like.
 *
 * The rejection loop is what keeps the digits uniform. Taking `% 1_000_000` of
 * a 32-bit value makes the low codes fractionally likelier than the high ones,
 * which is a small bias and a completely unnecessary one.
 */
export function generateCode(): string {
  const limit = 1_000_000;
  const ceiling = Math.floor(0xffffffff / limit) * limit;

  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= ceiling);

  return String(value % limit).padStart(6, "0");
}

/**
 * The code, as it is safe to put inside the challenge.
 *
 * The challenge is already encrypted, so this is defence in depth rather than
 * the primary control: it means that a leaked server secret exposes the
 * challenges but still not the codes inside them without a second pass.
 *
 * Salted with the destination, so the same code issued to two numbers hashes
 * differently and a challenge cannot be replayed against a different
 * destination even if one were somehow swapped in.
 */
async function hashCode(destination: Destination, code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${destination.channel}:${destination.value}:${code}`)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The opaque string a client keeps between `start` and `verify`. */
export async function sealChallenge(
  destination: Destination,
  code: string
): Promise<string | null> {
  const payload = JSON.stringify({
    c: destination.channel,
    d: destination.value,
    h: await hashCode(destination, code),
  });
  return seal(payload, CHALLENGE_TTL_SECONDS);
}

/**
 * Checks a code against a challenge.
 *
 * Returns the destination on success so the caller never has to trust a
 * destination the client sent alongside the code — the only destination that
 * can come out of here is the one that was sealed in.
 */
export async function openChallenge(
  challenge: unknown,
  code: unknown
): Promise<Destination | null> {
  if (typeof challenge !== "string" || typeof code !== "string") return null;

  // Anything but six digits cannot be a code this file issued, and refusing it
  // here keeps a megabyte of junk from reaching the hash.
  const entered = code.replace(/\D/g, "");
  if (entered.length !== 6) return null;

  const opened = await unseal(challenge);
  if (!opened) return null;

  let claims: { c?: unknown; d?: unknown; h?: unknown };
  try {
    claims = JSON.parse(opened) as typeof claims;
  } catch {
    return null;
  }

  if (claims.c !== "sms" && claims.c !== "email") return null;
  if (typeof claims.d !== "string" || typeof claims.h !== "string") return null;

  const destination: Destination = { channel: claims.c, value: claims.d };
  const expected = claims.h;
  const actual = await hashCode(destination, entered);

  /* Constant-time compare. The values are hex digests of equal length, so the
     usual `===` leaks only how long a shared prefix was — which for a hash of a
     six-digit code is not a practical attack. It is one line to do properly and
     the alternative is a comment explaining why it does not matter, which is
     how the one that DOES matter eventually gets written the same way. */
  if (expected.length !== actual.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  if (diff !== 0) return null;

  return destination;
}

/** The value for the long-lived cookie recording a proved contact. */
export async function sealVerified(destination: Destination): Promise<string | null> {
  return seal(`${destination.channel}:${destination.value}`, VERIFIED_TTL_SECONDS);
}

/** The proved contact in a request's cookies, or null if there is not one. */
export async function readVerified(sealed: string | undefined): Promise<Destination | null> {
  const opened = await unseal(sealed);
  if (!opened) return null;

  const separator = opened.indexOf(":");
  if (separator < 1) return null;

  const channel = opened.slice(0, separator);
  const value = opened.slice(separator + 1);
  if (channel !== "sms" && channel !== "email") return null;
  if (!value) return null;

  return { channel, value };
}

/**
 * `+256772123456` → `+256 77* *** 456`, for telling a shopper which number a
 * code went to without printing it in full on a screen somebody else can see.
 */
export function maskDestination({ channel, value }: Destination): string {
  if (channel === "sms") {
    return `${value.slice(0, 7)}* *** ${value.slice(-3)}`;
  }

  const [name, domain] = value.split("@");
  if (!domain) return value;
  const head = name.slice(0, Math.min(2, name.length));
  return `${head}${"*".repeat(Math.max(1, name.length - head.length))}@${domain}`;
}
