/**
 * Firebase Cloud Messaging, from the server.
 *
 * ---- Why this is hand-rolled rather than firebase-admin ----
 *
 * `firebase-admin` is a ~15MB dependency that pulls in gRPC, and it exists to
 * do many things this shop does not need: Firestore, Auth, Storage, Realtime
 * Database. What is actually needed here is one authenticated POST to the FCM
 * v1 endpoint, and the OAuth assertion that authorises it. That is the whole
 * surface, and it is written out below.
 *
 * The trade is that the token exchange is ours to get right. It is cached until
 * shortly before expiry, because minting one costs a round trip to Google and
 * an order confirmation should not wait on it.
 *
 * ---- Configuration ----
 *
 * A service account JSON from the Firebase console, in the environment:
 *
 *   FCM_PROJECT_ID       — from the JSON's `project_id`
 *   FCM_CLIENT_EMAIL     — from the JSON's `client_email`
 *   FCM_PRIVATE_KEY      — from the JSON's `private_key`, newlines as \n
 *
 * Absent, every function here becomes a no-op that reports it did nothing.
 * That is deliberate: a shop with no push configured must still be able to take
 * an order, and an order route that throws because notifications are not set up
 * has turned a nice-to-have into a checkout outage.
 */

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export type PushResult = {
  sent: number;
  failed: number;
  /** Tokens FCM rejected as permanently dead — deregister these. */
  stale: string[];
  /** Set when push is not configured, so callers can log it once and move on. */
  skipped?: boolean;
};

const NOT_CONFIGURED: PushResult = { sent: 0, failed: 0, stale: [], skipped: true };

function config() {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

export function pushConfigured(): boolean {
  return config() !== null;
}

// ---- The access token, and why it is cached ----

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string | null> {
  const settings = config();
  if (!settings) return null;

  // 60s of headroom. A token that expires between this check and FCM reading it
  // fails the send for no recoverable reason, and the window is free to buy.
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: settings.clientEmail,
    scope: FCM_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64url");

  const unsigned = `${encode(header)}.${encode(claims)}`;

  // Node's webcrypto rather than `crypto.sign`, so this works unchanged if the
  // route is ever moved to the edge runtime.
  const { subtle } = globalThis.crypto;
  const pem = settings.privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const key = await subtle.importKey(
    "pkcs8",
    Buffer.from(pem, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${Buffer.from(signature).toString("base64url")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[kandi-push] token exchange failed:", response.status);
    return null;
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

type Message = {
  title: string;
  body: string;
  /** Travels with the message and is read by the app, not shown. */
  data?: Record<string, string>;
};

async function post(
  target: { token: string } | { topic: string },
  message: Message
): Promise<{ ok: boolean; stale: boolean }> {
  const settings = config();
  const auth = await accessToken();
  if (!settings || !auth) return { ok: false, stale: false };

  const isPromo = message.data?.kind === "promo";

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${settings.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          ...target,
          notification: { title: message.title, body: message.body },
          data: message.data ?? {},
          android: {
            // Matches the channels the app creates. A message naming a channel
            // that does not exist is filed under the default one and ignores
            // every importance setting the shopper chose.
            priority: isPromo ? "NORMAL" : "HIGH",
            notification: {
              channel_id: isPromo ? "kandi_promos" : "kandi_orders",
            },
          },
          apns: {
            headers: { "apns-priority": isPromo ? "5" : "10" },
            payload: { aps: { sound: "default" } },
          },
        },
      }),
      cache: "no-store",
    }
  );

  if (response.ok) return { ok: true, stale: false };

  // 404 UNREGISTERED and 400 INVALID_ARGUMENT on the token are the two answers
  // that mean "this device is gone for good". Everything else — a 429, a 503 —
  // is temporary and the token must be kept.
  const text = await response.text().catch(() => "");
  const stale =
    response.status === 404 ||
    text.includes("UNREGISTERED") ||
    text.includes("INVALID_ARGUMENT");

  if (!stale) {
    console.error("[kandi-push] send failed:", response.status, text.slice(0, 200));
  }
  return { ok: false, stale };
}

/** Sends one message to specific devices. */
export async function pushToTokens(
  tokens: string[],
  message: Message
): Promise<PushResult> {
  if (!pushConfigured()) return NOT_CONFIGURED;
  if (tokens.length === 0) return { sent: 0, failed: 0, stale: [] };

  // In parallel, and settled rather than raced: one dead token among five must
  // not stop the other four, which is exactly what `Promise.all` would do.
  const results = await Promise.allSettled(
    tokens.map((token) => post({ token }, message))
  );

  const stale: string[] = [];
  let sent = 0;
  let failed = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.ok) {
      sent += 1;
      return;
    }
    failed += 1;
    if (result.status === "fulfilled" && result.value.stale) {
      stale.push(tokens[index]);
    }
  });

  return { sent, failed, stale };
}

/** Sends one message to everyone subscribed to a topic. */
export async function pushToTopic(
  topic: string,
  message: Message
): Promise<PushResult> {
  if (!pushConfigured()) return NOT_CONFIGURED;
  const result = await post({ topic }, message);
  return { sent: result.ok ? 1 : 0, failed: result.ok ? 0 : 1, stale: [] };
}

/**
 * The words a shopper sees when their order moves.
 *
 * Kept here rather than at the call sites so the shop has ONE voice across
 * every trigger — WordPress, the checkout route, a manual resend — and so
 * changing "on its way" everywhere is one edit.
 *
 * Returns null for statuses not worth a buzz. That is most of them: `pending`
 * fires the moment an order is created and would beat the confirmation to the
 * phone, and nobody needs to be interrupted to learn their order is `on-hold`.
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
