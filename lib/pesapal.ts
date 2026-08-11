/**
 * Pesapal API 3.0 client. Server-only — the consumer key and secret must never
 * reach the browser, so nothing in here may be imported from a client component.
 *
 * The flow this supports, end to end:
 *
 *   1. `submitOrder` gets a payment URL from Pesapal.
 *   2. The shopper pays inside an iframe pointed at that URL.
 *   3. Pesapal redirects the iframe to our callback, AND independently calls our
 *      IPN endpoint server-to-server.
 *   4. Both of those call `getTransactionStatus` — the callback and the IPN
 *      carry no payment status of their own, by design, so the status must
 *      always be fetched rather than trusted from the URL.
 *
 * The IPN is what makes this reliable: it fires even when the shopper closes
 * the tab mid-payment, which is exactly when a naive callback-only integration
 * takes the money and loses the order.
 */

const SANDBOX = "https://cybqa.pesapal.com/pesapalv3";
const LIVE = "https://pay.pesapal.com/v3";

export type PesapalConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  /** Registered IPN id, when one has been pinned in the environment. */
  ipnId: string;
};

/** Reads config from the environment, or null when Pesapal is not set up. */
export function pesapalConfig(): PesapalConfig | null {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) return null;

  return {
    // Anything other than an explicit "live" stays on the sandbox. Defaulting
    // the other way would mean a misspelt env var takes real money.
    baseUrl: process.env.PESAPAL_ENV === "live" ? LIVE : SANDBOX,
    consumerKey,
    consumerSecret,
    ipnId: process.env.PESAPAL_IPN_ID ?? "",
  };
}

/** True when the shop can take card / mobile money payments at all. */
export function pesapalEnabled(): boolean {
  return pesapalConfig() !== null;
}

export class PesapalError extends Error {}

/**
 * How long to wait on Pesapal before giving up.
 *
 * Without this, a Pesapal endpoint that hangs takes the whole request with it
 * until the hosting platform kills the function — and a killed function returns
 * the platform's own error page, not ours, so the shopper sees a bare "502"
 * and the log says nothing. Eight seconds is far longer than a healthy call and
 * comfortably inside every serverless timeout.
 */
const TIMEOUT_MS = 8000;

/** fetch with a deadline, reported as a PesapalError rather than an AbortError. */
async function fetchWithTimeout(url: string, init: RequestInit, what: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new PesapalError(
      timedOut
        ? `Pesapal did not answer in time (${what}). Please try again.`
        : `Could not reach Pesapal (${what}).`
    );
  }
}

/* ------------------------------------------------------------------ token */

// Tokens last five minutes. Cached in module scope and retired a minute early,
// so a request that starts just before expiry cannot finish just after it.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(config: PesapalConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const response = await fetchWithTimeout(
    `${config.baseUrl}/api/Auth/RequestToken`,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        consumer_key: config.consumerKey,
        consumer_secret: config.consumerSecret,
      }),
      cache: "no-store",
    },
    "signing in"
  );

  const data = (await response.json().catch(() => null)) as {
    token?: string;
    error?: { message?: string } | null;
    message?: string;
  } | null;

  if (!response.ok || !data?.token) {
    throw new PesapalError(
      data?.error?.message ?? data?.message ?? "Could not authenticate with Pesapal."
    );
  }

  cachedToken = { value: data.token, expiresAt: Date.now() + 4 * 60 * 1000 };
  return data.token;
}

async function call<T>(
  config: PesapalConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<T> {
  const token = await getToken(config);

  const response = await fetchWithTimeout(
    `${config.baseUrl}${path}`,
    {
      method: init.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    },
    path.split("/").pop() ?? "request"
  );

  const raw = await response.text();
  let data: (T & { error?: { message?: string } | null; message?: string }) | null = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok || !data) {
    // The first 200 characters of whatever came back. Pesapal answers a bad
    // key with an HTML page, and "Pesapal request failed (500)" on its own has
    // sent people looking for bugs in code that was working perfectly.
    console.error(
      `[kandi-store] pesapal ${path} → ${response.status}:`,
      raw.slice(0, 200) || "(empty body)"
    );
    throw new PesapalError(`Pesapal request failed (${response.status}).`);
  }

  // Pesapal answers 200 with a populated `error` object on business failures,
  // so the HTTP status alone is not enough to call it a success.
  if (data.error && (data.error.message || Object.keys(data.error).length > 0)) {
    const message = data.error.message;
    if (message) throw new PesapalError(message);
  }

  return data;
}

/* -------------------------------------------------------------------- IPN */

// Registering the IPN is idempotent from our side but costs a round trip, so
// the resolved id is remembered for the life of the process.
let cachedIpnId: string | null = null;

/**
 * The IPN id to attach to orders.
 *
 * Prefers `PESAPAL_IPN_ID`. Failing that it looks for our URL among the already
 * registered ones, and only registers a new one if it is genuinely absent —
 * otherwise every cold start would add another duplicate to the merchant
 * account.
 */
export async function resolveIpnId(config: PesapalConfig, ipnUrl: string): Promise<string> {
  if (config.ipnId) return config.ipnId;
  if (cachedIpnId) return cachedIpnId;

  const registered = await call<
    { url?: string; ipn_id?: string }[] | { url?: string; ipn_id?: string }
  >(config, "/api/URLSetup/GetIpnList", { method: "GET" });

  const list = Array.isArray(registered) ? registered : [registered];
  const existing = list.find((entry) => entry?.url === ipnUrl && entry.ipn_id);

  if (existing?.ipn_id) {
    cachedIpnId = existing.ipn_id;
    return cachedIpnId;
  }

  const created = await call<{ ipn_id?: string }>(config, "/api/URLSetup/RegisterIPN", {
    method: "POST",
    body: { url: ipnUrl, ipn_notification_type: "POST" },
  });

  if (!created.ipn_id) {
    throw new PesapalError("Pesapal did not return an IPN id.");
  }

  cachedIpnId = created.ipn_id;
  return cachedIpnId;
}

/* ------------------------------------------------------------ submit order */

export type BillingAddress = {
  email_address?: string;
  phone_number?: string;
  country_code?: string;
  first_name?: string;
  last_name?: string;
  line_1?: string;
  city?: string;
};

export type SubmitOrderInput = {
  /** Our own reference. Alphanumerics, dashes, underscores, dots, colons only. */
  id: string;
  currency: string;
  amount: number;
  description: string;
  callbackUrl: string;
  cancellationUrl?: string;
  notificationId: string;
  billingAddress: BillingAddress;
};

export type SubmitOrderResult = {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
};

/**
 * Strips a reference down to what Pesapal accepts, and caps it at their 50
 * character limit. An order id with a stray character in it is rejected with a
 * generic error that is miserable to debug, so it is sanitised here rather than
 * trusted from the caller.
 */
export function safeReference(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, 50);
}

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  const config = pesapalConfig();
  if (!config) throw new PesapalError("Pesapal is not configured.");

  return call<SubmitOrderResult>(config, "/api/Transactions/SubmitOrderRequest", {
    method: "POST",
    body: {
      id: safeReference(input.id),
      currency: input.currency,
      amount: Number(input.amount.toFixed(2)),
      description: input.description.slice(0, 100),
      callback_url: input.callbackUrl,
      cancellation_url: input.cancellationUrl,
      // The payment runs inside our own iframe, so the callback must load in
      // that frame rather than blowing away the whole shop behind it.
      redirect_mode: "PARENT_WINDOW",
      notification_id: input.notificationId,
      billing_address: input.billingAddress,
    },
  });
}

/* ----------------------------------------------------------------- status */

export type TransactionStatus = {
  payment_method?: string;
  amount?: number;
  confirmation_code?: string;
  payment_status_description?: string;
  description?: string;
  payment_account?: string;
  /** 0 INVALID · 1 COMPLETED · 2 FAILED · 3 REVERSED */
  status_code?: number;
  merchant_reference?: string;
  currency?: string;
};

export async function getTransactionStatus(
  orderTrackingId: string
): Promise<TransactionStatus> {
  const config = pesapalConfig();
  if (!config) throw new PesapalError("Pesapal is not configured.");

  return call<TransactionStatus>(
    config,
    `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { method: "GET" }
  );
}

/** Pesapal's status_code 1 is the only one that means the money arrived. */
export function isPaid(status: TransactionStatus): boolean {
  return Number(status.status_code) === 1;
}
