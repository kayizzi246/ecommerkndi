import { privateJson } from "@/lib/private-json";
import { pushToTokens, pushToTopic, orderMessage, pushConfigured } from "@/lib/push";

/**
 * POST /api/notifications/send
 *
 * The one way a notification gets sent. Called by WordPress when an order
 * changes status, and by the shop's own tooling to announce a promotion.
 *
 * ---- Why WordPress calls in rather than sending itself ----
 *
 * FCM v1 needs a signed JWT and an OAuth exchange to authorise every send. That
 * is written once, in `lib/push.ts`, in a language with a crypto library that
 * does it in four lines. Reimplementing it in PHP would be a second
 * implementation of the fiddliest part of this feature, kept in step by hand.
 *
 * So WordPress owns WHO to notify — it has the orders and the device table —
 * and this owns HOW. The split follows the data.
 *
 * ---- Authentication ----
 *
 * The shared secret both systems already use, in `X-Kandi-Secret`. This is not
 * a public endpoint and there is no user session involved: it is server to
 * server, and the secret is the only credential that makes sense.
 *
 * Compared in constant time. A plain `===` on a secret leaks its length and,
 * over enough requests, its content through timing — a small risk here, but the
 * fix is one function call.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function secretMatches(supplied: string | null): boolean {
  const expected = process.env.KANDI_API_SECRET ?? "";
  if (!expected || !supplied) return false;
  if (supplied.length !== expected.length) return false;

  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) {
    difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

type Body = {
  /** "order" or "promo". */
  kind?: string;
  /** Order sends: the devices belonging to the customer on the order. */
  tokens?: unknown;
  /** Order sends: the WooCommerce status the order just moved to. */
  status?: string;
  order_number?: string;
  /** Promo sends: the topic and the words, which are written by a person. */
  topic?: string;
  title?: string;
  body?: string;
};

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-kandi-secret"))) {
    return privateJson({ message: "Not authorised." }, { status: 401 });
  }

  if (!pushConfigured()) {
    // 200, not 500. Push being unconfigured is a deployment state, not a
    // failure of this request, and WordPress must not retry an order hook
    // forever because the shop has not set up Firebase yet.
    return privateJson({ sent: 0, skipped: true }, { status: 200 });
  }

  const payload = (await request.json().catch(() => ({}))) as Body;

  if (payload.kind === "promo") {
    const title = (payload.title ?? "").trim();
    const body = (payload.body ?? "").trim();
    if (!title || !body) {
      return privateJson({ message: "A title and a body are required." }, { status: 400 });
    }

    // An allow-list, because a topic name is a broadcast address. A typo would
    // send to a topic nobody is subscribed to and look like a silent failure;
    // an arbitrary string from a compromised caller would be worse.
    const allowed = new Set(["promos", "price_drops", "new_arrivals"]);
    const topic = (payload.topic ?? "promos").trim();
    if (!allowed.has(topic)) {
      return privateJson({ message: "Unknown topic." }, { status: 400 });
    }

    const result = await pushToTopic(topic, {
      title,
      body,
      // `kind` is what the app reads to pick the quieter channel — see the
      // channel note in push_notifications.dart.
      data: { kind: "promo", topic },
    });
    return privateJson(result, { status: 200 });
  }

  // ---- An order moved ----

  const tokens = Array.isArray(payload.tokens)
    ? payload.tokens.filter((t): t is string => typeof t === "string" && t.length > 32)
    : [];

  const message = orderMessage(
    (payload.status ?? "").trim(),
    (payload.order_number ?? "").trim()
  );

  // Not every status is worth a buzz, and `orderMessage` is where that is
  // decided. A 200 with `sent: 0` is the honest answer: the request was fine,
  // there was simply nothing to say.
  if (!message) {
    return privateJson({ sent: 0, ignored: true }, { status: 200 });
  }
  if (tokens.length === 0) {
    return privateJson({ sent: 0, reason: "no devices" }, { status: 200 });
  }

  const result = await pushToTokens(tokens, message);

  // `stale` comes back so WordPress can delete those rows. Without pruning, a
  // device table only grows, and every promotion is then sent to a majority of
  // tokens belonging to apps that were uninstalled months ago.
  return privateJson(result, { status: 200 });
}
