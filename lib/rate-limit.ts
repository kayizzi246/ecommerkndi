/**
 * Request throttling for the endpoints that are worth attacking.
 *
 * The shop had none. Every credential endpoint — shopper sign-in, seller
 * sign-in, the owner passcode, password reset — accepted unlimited attempts at
 * full speed, which makes a weak password a matter of time rather than luck and
 * makes the whole site a free oracle for testing stolen credential lists. The
 * contact form and the review endpoint had the same problem in a different
 * shape: nothing stopped a script filling the inbox or the product pages.
 *
 * ## What this is, and what it is not
 *
 * A fixed-window counter held in the process's own memory. That choice has real
 * limits and it is better to state them than to imply protection that is not
 * there:
 *
 *  • **Per instance.** On a serverless or multi-instance deployment each
 *    instance keeps its own counters, so the effective limit is the configured
 *    one multiplied by the number of warm instances. It raises the cost of an
 *    attack by a large factor; it does not make it arithmetically impossible.
 *  • **Memory resets on deploy.** A cold start forgets every counter.
 *  • **Keyed on client IP**, which is shared behind carrier NAT — common in
 *    Uganda, where a lot of traffic arrives through a handful of mobile
 *    gateways. The limits below are deliberately loose enough that a street of
 *    people on the same MTN egress IP do not lock each other out.
 *
 * The upgrade path, when the shop is big enough to need it, is to move the
 * counter into something shared — Upstash Redis, Vercel KV, or Cloudflare's own
 * rate limiting in front of the origin — keeping this exact interface. The
 * right first move is still this one: an in-memory limiter deployed today stops
 * every unsophisticated attack, which is virtually all of them.
 */

type Bucket = {
  count: number;
  /** Epoch ms at which this window ends and the count resets. */
  resetAt: number;
};

/**
 * Live windows, keyed by `${bucket}:${identifier}`.
 *
 * Module scope, so it survives between requests within one instance.
 */
const buckets = new Map<string, Bucket>();

/**
 * The map must not be allowed to grow without bound.
 *
 * An attacker rotating source addresses would otherwise turn the thing meant to
 * protect the process into the thing that exhausts its memory — a rate limiter
 * that becomes the denial of service is worse than none. Two defences: expired
 * entries are swept periodically, and a hard ceiling drops the oldest windows
 * if the sweep cannot keep up.
 */
const MAX_TRACKED_KEYS = 20_000;
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  // Still too many live windows: an attack is in progress and every entry is
  // current. Drop the oldest, which are the closest to expiring anyway. Map
  // iterates in insertion order, so this takes them in the order they arrived.
  if (buckets.size > MAX_TRACKED_KEYS) {
    const excess = buckets.size - MAX_TRACKED_KEYS;
    let dropped = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++dropped >= excess) break;
    }
  }
}

export type RateLimitResult = {
  /** False when the caller has spent its allowance for this window. */
  ok: boolean;
  /** Attempts left in the current window. */
  remaining: number;
  /** Whole seconds until the window resets — the `Retry-After` value. */
  retryAfterSeconds: number;
};

/**
 * Counts one request against a window.
 *
 * @param bucket     Names the limit — usually the route. Keeping buckets
 *                   separate means somebody hammering the contact form does not
 *                   also lock themselves out of signing in.
 * @param identifier Who is being limited. Normally the client IP; for endpoints
 *                   where the account matters more than the source, the email.
 */
export function rateLimit(
  bucket: string,
  identifier: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const key = `${bucket}:${identifier}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * The caller's IP address, as best the platform can tell us.
 *
 * `x-forwarded-for` is a list appended to by each hop; the *first* entry is the
 * original client. Taking the last would let anyone choose their own key by
 * sending the header themselves, which would make the limiter trivially
 * bypassable — the one mistake in this function that matters.
 *
 * Vercel and Cloudflare both overwrite the client-supplied value at the edge,
 * so the first entry is trustworthy there. Behind a proxy that does not, this
 * is only as good as that proxy.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    // No address at all: bucket these together rather than treating them as
    // unlimited. An unidentifiable caller should be the *most* restricted, not
    // the least.
    "unknown"
  );
}

/**
 * The 429 to send when a limit is hit.
 *
 * `Retry-After` is set because a well-behaved client — including Googlebot —
 * reads it and backs off politely instead of retrying into the wall. The
 * message is deliberately vague about which limit was hit: telling a script
 * exactly how many attempts it has left per window is telling it how to pace
 * itself to stay under.
 */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { message: "Too many attempts. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    }
  );
}

/**
 * The limits themselves, in one place so they can be reasoned about together.
 *
 * Each is set to be invisible to a real person having a bad day — mistyping a
 * password four times, resending a verification email — and expensive for a
 * script. The credential limits are the tight ones; browsing is untouched.
 */
export const LIMITS = {
  /** Password sign-in: shopper, seller and owner. */
  signIn: { limit: 8, windowMs: 10 * 60_000 },
  /** Account creation, per source address. */
  register: { limit: 5, windowMs: 60 * 60_000 },
  /** Password reset and email resend — each one sends mail on our account. */
  passwordReset: { limit: 4, windowMs: 60 * 60_000 },
  /** Contact form. Generous, because a genuine customer may write twice. */
  contact: { limit: 5, windowMs: 30 * 60_000 },
  /** Review submission. */
  review: { limit: 10, windowMs: 60 * 60_000 },
  /** Cache purge. Enough for real product edits, not enough to melt the site. */
  revalidate: { limit: 30, windowMs: 60_000 },
  /** Anything else on /api that is worth a ceiling. */
  api: { limit: 120, windowMs: 60_000 },
} as const;
