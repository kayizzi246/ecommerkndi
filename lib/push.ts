/**
 * Push notifications, through OneSignal.
 *
 * ---- What this replaced, and why it is so much shorter ----
 *
 * This was written against Firebase Cloud Messaging first. FCM is a TRANSPORT:
 * it moves a message to a device token and stops, so everything around it was
 * ours — a device table in WordPress, a route to write to it, token rotation, a
 * pruning pass for dead tokens, the join from an order to the devices its
 * customer holds, and an RS256-signed JWT plus an OAuth exchange for every send.
 *
 * OneSignal is that entire layer. It keeps the subscriptions, it knows which
 * devices belong to a customer once the app has told it that customer's id, and
 * it addresses them by that id. Everything in the paragraph above was deleted
 * rather than ported:
 *
 *   • No device table, and no `/api/app/notifications/register`.
 *   • No token pruning — hence no `stale` in the result any more. There is
 *     nothing on our side to prune.
 *   • No JWT signing. A REST key in a header.
 *
 * ---- Push only. This is a billing constraint, not a preference ----
 *
 * OneSignal bills for email, for SMS, and for web push past 10,000 subscribers.
 * Mobile push is unlimited on the free plan, and mobile push is the entirety of
 * what this shop sends: every function below hardcodes `target_channel: "push"`
 * and there is no email or SMS call anywhere in this file.
 *
 * Keep it that way. Shop email goes through wp_mail on WordPress — see the
 * Kandi Notifications plugin — and moving any of it here would put a bill on
 * something that currently costs nothing. If a transactional message needs
 * adding, it belongs in that plugin's template, not in an OneSignal channel.
 *
 * ---- Configuration ----
 *
 *   ONESIGNAL_APP_ID       — the same id the app is built with
 *   ONESIGNAL_REST_API_KEY — from Settings > Keys & IDs. SERVER ONLY.
 *
 * Absent, every function here becomes a no-op that reports it did nothing. That
 * is deliberate: a shop with no push configured must still take orders, and a
 * checkout that throws because notifications are not set up has turned a
 * nice-to-have into an outage.
 */

const ONESIGNAL_API = "https://api.onesignal.com/notifications";

export type PushResult = {
  sent: number;
  failed: number;
  /** OneSignal's id for the notification, useful when chasing one up. */
  id?: string;
  /** Set when push is not configured, so callers log it once and move on. */
  skipped?: boolean;
};

const NOT_CONFIGURED: PushResult = { sent: 0, failed: 0, skipped: true };

function config() {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !restKey) return null;
  return { appId, restKey };
}

export function pushConfigured(): boolean {
  return config() !== null;
}

type Message = {
  title: string;
  body: string;
  /** Travels with the message and is read by the app, not shown. */
  data?: Record<string, string>;
};

/**
 * The tag names the app writes, and the only ones a promotion may filter on.
 *
 * `push_notifications.dart` holds the same three strings. The two have to
 * agree: a send filtered on a tag the app never sets reaches nobody, and does
 * it silently — no error, a successful-looking response, and zero recipients.
 */
export const PUSH_TAGS = ["deals", "price_drops", "new_arrivals"] as const;
export type PushTag = (typeof PUSH_TAGS)[number];

async function post(body: Record<string, unknown>): Promise<PushResult> {
  const settings = config();
  if (!settings) return NOT_CONFIGURED;

  try {
    const response = await fetch(ONESIGNAL_API, {
      method: "POST",
      headers: {
        // The current scheme. OneSignal's older docs show `Basic <key>`; keys
        // issued now are used as `Key <key>` and the old form is being retired.
        Authorization: `Key ${settings.restKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ app_id: settings.appId, ...body }),
      cache: "no-store",
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      recipients?: number;
      errors?: unknown;
    };

    if (!response.ok) {
      console.error("[kandi-push] send failed:", response.status, data.errors);
      return { sent: 0, failed: 1 };
    }

    // A 200 with zero recipients is the quiet failure worth surfacing: the
    // request was perfect and nobody matched it. Usually a customer id that has
    // never opened the app, or a tag the app is not writing.
    const recipients = typeof data.recipients === "number" ? data.recipients : 0;
    if (recipients === 0) {
      console.warn("[kandi-push] accepted but matched no subscribers:", data.id);
    }

    return { sent: recipients, failed: 0, id: data.id };
  } catch (error) {
    console.error("[kandi-push] unreachable:", error);
    return { sent: 0, failed: 1 };
  }
}

/**
 * Sends to one customer, on every device they have signed in on.
 *
 * The id is the WordPress customer id, which the app sets as its OneSignal
 * external id at sign-in. The shop does not need to know how many handsets that
 * is, or whether any of them are still installed — which is the whole reason
 * this is addressed by customer rather than by device.
 */
export async function pushToCustomer(
  customerId: string | number,
  message: Message
): Promise<PushResult> {
  if (!pushConfigured()) return NOT_CONFIGURED;

  const id = String(customerId).trim();
  if (!id) return { sent: 0, failed: 0 };

  return post({
    include_aliases: { external_id: [id] },
    target_channel: "push",
    headings: { en: message.title },
    contents: { en: message.body },
    data: message.data ?? {},
    // 10 is "deliver now" for APNs; order news is time-critical by definition.
    priority: 10,
  });
}

/**
 * Sends to one seller, on every device they have signed into their store on.
 *
 * ---- Why a tag and not an alias ----
 *
 * A subscription has exactly one external id, and that is the SHOPPER's — see
 * the note in `push_notifications.dart`. One handset routinely carries both
 * identities: a seller who also shops from their own phone. Addressing sellers
 * by external id would mean one of the two silently stopping.
 *
 * So the app writes a `seller_id` tag and this filters on it. Both kinds of
 * message then arrive on the same device, which is the correct behaviour and
 * costs nothing to arrange.
 */
export async function pushToSeller(
  sellerId: string | number,
  message: Message
): Promise<PushResult> {
  if (!pushConfigured()) return NOT_CONFIGURED;

  const id = String(sellerId).trim();
  if (!id) return { sent: 0, failed: 0 };

  return post({
    filters: [{ field: "tag", key: "seller_id", relation: "=", value: id }],
    target_channel: "push",
    headings: { en: message.title },
    contents: { en: message.body },
    data: { ...(message.data ?? {}), kind: "seller" },
    // A seller with an unpacked order is losing money by the minute. This is
    // the one notification in the shop more time-critical than a delivery
    // update, so it gets the same top priority.
    priority: 10,
  });
}

/**
 * What a seller is told when something needs them.
 *
 * Separate from `orderMessage` and deliberately not sharing its wording: the
 * shopper is being reassured and the seller is being asked to act, and copy
 * that tries to serve both ends up doing neither.
 */
export function sellerMessage(
  event: string,
  orderNumber: string
): Message | null {
  switch (event) {
    case "new-order":
      return {
        title: "New order",
        body: `Order #${orderNumber} is waiting to be packed.`,
        data: { event, order: orderNumber },
      };
    case "order-cancelled":
      return {
        title: "Order cancelled",
        body: `Order #${orderNumber} was cancelled. Do not pack it.`,
        data: { event, order: orderNumber },
      };
    case "payout-sent":
      return {
        title: "Payout sent",
        body: `Your payout has been sent. Check the Seller Centre for details.`,
        data: { event },
      };
    default:
      return null;
  }
}

/**
 * Sends to everyone whose subscription carries a tag.
 *
 * A tag rather than a segment, so the audience is defined by the switch the
 * shopper actually set in the app rather than by a rule someone drew in the
 * OneSignal dashboard that the app knows nothing about.
 */
export async function pushToTag(
  tag: PushTag,
  message: Message
): Promise<PushResult> {
  if (!pushConfigured()) return NOT_CONFIGURED;

  return post({
    filters: [{ field: "tag", key: tag, relation: "=", value: "1" }],
    target_channel: "push",
    headings: { en: message.title },
    contents: { en: message.body },
    data: { ...(message.data ?? {}), kind: "promo" },
    // 5, not 10. A flash sale that arrives with the same urgency as "your
    // parcel is at the door" is how an app gets its notifications turned off
    // wholesale — and the shop then loses the delivery ones it needed.
    priority: 5,
  });
}

/**
 * The words a shopper sees when their order moves.
 *
 * Kept here rather than at the call sites so the shop has ONE voice across
 * every trigger — WordPress, the checkout route, a manual resend — and so
 * changing "on the way" everywhere is one edit.
 *
 * Returns null for statuses not worth a buzz, which is most of them: `pending`
 * fires the moment an order is created and would beat the confirmation to the
 * phone, and nobody needs interrupting to learn their order is `on-hold`.
 */
export function orderMessage(
  status: string,
  orderNumber: string
): Message | null {
  switch (status) {
    case "processing":
      return {
        title: "Order confirmed",
        body: `We have your order #${orderNumber} and are getting it ready.`,
        data: { kind: "order", status, order: orderNumber },
      };
    case "out-for-delivery":
      return {
        title: "On the way",
        body: `Order #${orderNumber} is out for delivery. Keep your phone nearby.`,
        data: { kind: "order", status, order: orderNumber },
      };
    case "completed":
      return {
        title: "Delivered",
        body: `Order #${orderNumber} has been delivered. Enjoy!`,
        data: { kind: "order", status, order: orderNumber },
      };
    case "cancelled":
      return {
        title: "Order cancelled",
        body: `Order #${orderNumber} was cancelled. Tap for details.`,
        data: { kind: "order", status, order: orderNumber },
      };
    case "refunded":
      return {
        title: "Refund on its way",
        body: `Your refund for order #${orderNumber} is being processed.`,
        data: { kind: "order", status, order: orderNumber },
      };
    default:
      return null;
  }
}
