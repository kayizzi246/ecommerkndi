/**
 * "I already placed this order."
 *
 * ---- What goes wrong without it ----
 *
 * Checkout is one POST that creates a real WooCommerce order, decrements real
 * stock and sends a real email. There are three ordinary ways for a shopper to
 * send it twice, none of which involve malice:
 *
 *   • The connection stalls on a Ugandan mobile network, the request actually
 *     arrived, and they press "Place order" again.
 *   • They double-tap the button, which on a slow phone is two requests before
 *     the first `setSubmitting(true)` has painted.
 *   • The browser retries the POST itself after a dropped socket.
 *
 * Each one produces two identical orders. The shop packs both, the shopper is
 * charged for both, and somebody notices a week later.
 *
 * It is also the cheapest half of the abuse story: a replayed request costs
 * nothing once it is recognised, so a script hammering the same payload gets
 * one order and a lot of cached answers rather than a thousand orders.
 *
 * ---- How it works ----
 *
 * The client generates a random key per checkout ATTEMPT — not per session, not
 * per cart — and sends it as `Idempotency-Key`. The first request with a given
 * key claims it; any request arriving with a key already claimed gets the first
 * one's answer back instead of doing the work again.
 *
 * ---- Where the claims live ----
 *
 * Upstash Redis when it is configured, which is the only version that works
 * across instances and is the one that matters in production. In-process
 * otherwise, which still catches the double-tap and the browser retry — both of
 * which land on the same warm instance within seconds — and is honestly weaker
 * against the stalled-connection case on a multi-instance deployment. Stated
 * plainly rather than papered over: this is a good reason to set the Upstash
 * variables before a launch.
 */

/** How long an answer is remembered. Comfortably longer than any human retry. */
const TTL_SECONDS = 24 * 60 * 60;

type Entry = { value: unknown; expiresAt: number };

const memory = new Map<string, Entry>();

/** Bounded, for the same reason the rate limiter's map is — see `lib/rate-limit.ts`. */
const MAX_KEYS = 5_000;

function memoryGet(key: string): unknown | undefined {
  const entry = memory.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return undefined;
  }
  return entry.value;
}

function memorySet(key: string, value: unknown, ttlSeconds = TTL_SECONDS) {
  if (memory.size >= MAX_KEYS) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
}

function upstash(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/**
 * One Redis command, with "it answered" and "it did not" kept apart.
 *
 * ---- Why this returns a box rather than the value ----
 *
 * It used to return `data.result ?? null`, so a `null` answer FROM Redis and a
 * failure to reach Redis at all were the same value. For `GET` that is
 * harmless: a missing key and an unreachable store both mean "no cached answer
 * here", and the caller falls through to the in-process copy either way.
 *
 * For `SET … NX` it was a hole straight through the middle of the lock.
 * `SET NX` answers `"OK"` when it takes the key and `null` when somebody else
 * already holds it — so the ONE answer that means "you did not get the lock"
 * was being read as "Redis is down", `claim` fell through to the in-process
 * path, found no local lock (the holder is on another instance, which is the
 * entire case Redis is here for), and granted the claim. Two instances could
 * each be told they owned the same checkout.
 *
 * That is the failure this whole module exists to prevent, and it was silent:
 * with Upstash configured and healthy, cross-instance double-submit protection
 * degraded to per-instance, and nothing anywhere logged that it had.
 *
 * `null` from this function now means UNREACHABLE and nothing else. A reply of
 * `null` from Redis comes back as `{ result: null }`, which is a fact the
 * caller can act on.
 */
async function redis(command: unknown[]): Promise<{ result: unknown } | null> {
  const config = upstash();
  if (!config) return null;

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { result?: unknown };
    return { result: data?.result ?? null };
  } catch {
    return null;
  }
}

/**
 * The key the caller sent, if it is one we are willing to key a cache on.
 *
 * Length and character class are checked because this string becomes part of a
 * Redis key and part of a map key: an unbounded value from an untrusted client
 * is how a cache becomes a memory-exhaustion vector.
 */
export function idempotencyKey(request: Request): string | null {
  const raw = request.headers.get("idempotency-key")?.trim();
  if (!raw) return null;
  if (raw.length < 8 || raw.length > 128) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(raw)) return null;
  return raw;
}

/**
 * The answer already given for this key, if there is one.
 */
export async function replayOf(bucket: string, key: string): Promise<unknown | undefined> {
  const answer = await redis(["GET", `idem:${bucket}:${key}`]);
  if (answer && typeof answer.result === "string") {
    try {
      return JSON.parse(answer.result);
    } catch {
      return undefined;
    }
  }
  // Redis unreachable, or it has no answer for this key. Both fall through to
  // the in-process copy, which `remember` always writes: on the instance that
  // handled the first request it is the faster answer, and it is what survives
  // a brief Upstash outage between the two requests.
  return memoryGet(`${bucket}:${key}`);
}

/**
 * Remembers what this key answered.
 *
 * Written to both stores. The local copy is not redundant when Redis is
 * configured — it answers the double-tap without a round trip, and it is what
 * remains if Redis is briefly unreachable on the retry.
 */
export async function remember(bucket: string, key: string, value: unknown): Promise<void> {
  memorySet(`${bucket}:${key}`, value);
  await redis(["SET", `idem:${bucket}:${key}`, JSON.stringify(value), "EX", String(TTL_SECONDS)]);
}

/**
 * Claims a key before doing the work, so two requests racing on the same key
 * cannot both proceed.
 *
 * Returns false when somebody else already holds it. Only meaningful with Redis
 * behind it — `SET NX` there is atomic across instances, which is the whole
 * point — and in-memory it still closes the double-tap window on one instance.
 *
 * The claim is short-lived on purpose. If the first request dies halfway
 * through, a shopper pressing the button again twenty seconds later should get
 * a real attempt rather than a lock held by a request that no longer exists.
 */
export async function claim(bucket: string, key: string): Promise<boolean> {
  const redisKey = `idem:lock:${bucket}:${key}`;
  const answer = await redis(["SET", redisKey, "1", "NX", "EX", "20"]);

  // Redis answered. Its answer is the whole answer, and `null` from `SET NX`
  // means somebody else holds the key — see the note on `redis` for the bug
  // that read that `null` as an outage and handed out the lock anyway.
  if (answer) return answer.result === "OK";

  // Only now, with Redis genuinely unreachable or unconfigured, does the
  // in-process lock decide. It still closes the double-tap and the browser
  // retry, which land on the same warm instance seconds apart.
  const memoryKey = `lock:${bucket}:${key}`;
  if (memoryGet(memoryKey) !== undefined) return false;
  memorySet(memoryKey, 1, 20);
  return true;
}
