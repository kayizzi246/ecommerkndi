import { privateJson } from "@/lib/private-json";
import {
  pushToCustomer,
  pushToTag,
  orderMessage,
  pushConfigured,
  PUSH_TAGS,
  type PushTag,
} from "@/lib/push";

/**
 * POST /api/notifications/send
 *
 * The one way a notification gets sent. Called by WordPress when an order
 * changes status, and by the shop's own tooling to announce a promotion.
 *
 * ---- Why WordPress calls in rather than sending itself ----
 *
 * It could. OneSignal is one authenticated POST and PHP can make it. The reason
 * it does not is that the WORDING lives here, in `orderMessage` — one place
 * where the shop's voice is decided, shared by every trigger. Spreading the
 * copy across a PHP hook and a TypeScript route is how "on the way" ends up
 * phrased two ways depending on what fired it.
 *
 * So WordPress owns WHEN and WHO — it has the orders and the customer ids —
 * and this owns WHAT IT SAYS and HOW IT GOES. The split follows the concern.
 *
 * Note WordPress sends a CUSTOMER ID, not device tokens. It does not have any:
 * OneSignal keeps the subscriptions and matches them by the external id the app
 * sets at sign-in.
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
  /** Order sends: the WordPress customer id on the order. */
  customer_id?: string | number;
  /** Order sends: the WooCommerce status the order just moved to. */
  status?: string;
  order_number?: string;
  /** Promo sends: the tag and the words, which are written by a person. */
  tag?: string;
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
    // forever because the shop has not set up OneSignal yet.
    return privateJson({ sent: 0, skipped: true }, { status: 200 });
  }

  const payload = (await request.json().catch(() => ({}))) as Body;

  if (payload.kind === "promo") {
    const title = (payload.title ?? "").trim();
    const body = (payload.body ?? "").trim();
    if (!title || !body) {
      return privateJson({ message: "A title and a body are required." }, { status: 400 });
    }

    // An allow-list, and it is the SAME list the app writes — see PUSH_TAGS.
    // A typo would filter on a tag no subscription carries, which OneSignal
    // accepts happily and delivers to nobody: a 200, an id, zero recipients.
    // That is the failure mode worth spending a guard on.
    const tag = (payload.tag ?? "deals").trim();
    if (!(PUSH_TAGS as readonly string[]).includes(tag)) {
      return privateJson({ message: "Unknown tag." }, { status: 400 });
    }

    const result = await pushToTag(tag as PushTag, { title, body });
    return privateJson(result, { status: 200 });
  }

  // ---- An order moved ----

  const customerId = String(payload.customer_id ?? "").trim();

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
  // A guest order has no customer to address. Not an error — plenty of orders
  // are placed without an account — so this answers 200 and says why.
  if (!customerId) {
    return privateJson({ sent: 0, reason: "no customer" }, { status: 200 });
  }

  const result = await pushToCustomer(customerId, message);
  return privateJson(result, { status: 200 });
}
