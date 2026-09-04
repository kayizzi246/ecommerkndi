import { cookies } from "next/headers";
import { privateJson } from "@/lib/private-json";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import {
  openChallenge,
  sealVerified,
  VERIFIED_COOKIE,
  VERIFIED_TTL_SECONDS,
} from "@/lib/otp";

/**
 * Checks a code against a challenge and, on success, records the contact as
 * proved on this browser.
 *
 * ---- The limiter is the guard, not the token ----
 *
 * A sealed challenge cannot count its own attempts — the server keeps nothing,
 * so a client holding a valid token could otherwise try all million codes
 * against it. That is stated at length in `lib/otp.ts`; this is where it is
 * paid for.
 *
 * Ten attempts per ten minutes per source, and separately per challenge, makes
 * a six-digit code a one-in-a-hundred-thousand proposition per window and a
 * roughly one-in-seventeen-hundred proposition across the code's whole ten
 * minute life. The per-challenge window is the one that matters: without it a
 * caller could rotate through source addresses and keep hammering one token.
 *
 * The challenge is hashed into the limiter key rather than used raw, because it
 * is a long base64url string and Redis keys should not be arbitrary-length
 * attacker-controlled data — the same reason `idempotencyKey` bounds what it
 * will accept.
 */
export const dynamic = "force-dynamic";

const VERIFY_LIMITS = {
  bySource: { limit: 10, windowMs: 10 * 60_000 },
  byChallenge: { limit: 10, windowMs: 10 * 60_000 },
} as const;

/** A short, fixed-length, non-reversible key for a challenge string. */
async function challengeKey(challenge: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(challenge));
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  const bySource = await enforceRateLimit(
    "otp:verify:ip",
    clientIp(request),
    VERIFY_LIMITS.bySource
  );
  if (bySource) return bySource;

  const body = (await request.json().catch(() => ({}))) as {
    challenge?: unknown;
    code?: unknown;
  };

  if (typeof body.challenge !== "string" || body.challenge.length > 4096) {
    return privateJson({ message: "That code has expired. Ask for a new one." }, { status: 400 });
  }

  const byChallenge = await enforceRateLimit(
    "otp:verify:challenge",
    await challengeKey(body.challenge),
    VERIFY_LIMITS.byChallenge
  );
  if (byChallenge) return byChallenge;

  const destination = await openChallenge(body.challenge, body.code);
  if (!destination) {
    /* One message for a wrong code, an expired challenge and a tampered one.
       Telling them apart would let a caller learn whether a challenge is still
       live, which is the first half of deciding whether to keep guessing. */
    return privateJson(
      { message: "That code is not right. Check it, or ask for a new one." },
      { status: 400 }
    );
  }

  const sealed = await sealVerified(destination);
  if (!sealed) {
    return privateJson(
      { message: "Verification is not available right now. Please try again shortly." },
      { status: 503 }
    );
  }

  (await cookies()).set(VERIFIED_COOKIE, sealed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VERIFIED_TTL_SECONDS,
  });

  return privateJson({
    ok: true,
    channel: destination.channel,
    /* The full value comes back, and only here. The caller has just proved they
       hold it, and the forms downstream — checkout's phone field, the seller
       sign-up — pre-fill from it so a shopper does not type the same number
       twice in one flow. */
    contact: destination.value,
  });
}
