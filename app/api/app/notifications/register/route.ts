import { appAuthJson, appBearerToken } from "@/lib/app-auth";
import { appPreflight } from "@/lib/app-api";
import { callCustomerApi } from "@/lib/customer-server";
import { clientIp, rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/app/notifications/register
 *
 * Records this handset's FCM token so the shop can reach it.
 *
 * ---- Signed in is optional, and that is the point ----
 *
 * A device with no session still registers. It cannot receive order updates —
 * there are no orders to update — but it is how a shopper who has never signed
 * in still gets told about a sale, and how the token is already on file the
 * moment they do sign in.
 *
 * When a bearer token IS present the device is filed against that customer,
 * which is what makes "your order is on the way" addressable. The app
 * re-registers after every sign-in and sign-out for exactly this reason.
 *
 * ---- Where the tokens live ----
 *
 * WordPress, alongside the customer record. Not in this process: a Next.js
 * route handler on a serverless host has no durable store, and the alternative
 * — a second database just for device tokens — would put the answer to "who do
 * I notify about this order" in a different system from the order.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function OPTIONS() {
  return appPreflight();
}

export async function POST(request: Request) {
  // Throttled per source. Registration is cheap and idempotent, so this is not
  // guarding an expensive path — it is stopping one client filling the device
  // table with junk tokens, which would then be sent to on every promotion.
  const ip = clientIp(request);
  const limit = rateLimit("push-register:ip", ip, LIMITS.signIn);
  if (!limit.ok) {
    return appAuthJson({ message: "Too many attempts." }, 429);
  }

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    platform?: string;
  };

  const token = (body.token ?? "").trim();
  const platform = body.platform === "ios" ? "ios" : "android";

  // FCM tokens are long. A short string here is a bug in the caller or someone
  // poking at the endpoint, and either way it is not worth storing.
  if (token.length < 32) {
    return appAuthJson({ message: "A device token is required." }, 400);
  }

  const auth = appBearerToken(request);

  const { status, data } = await callCustomerApi("/devices", {
    method: "POST",
    // Anonymous is allowed here, unlike everywhere else in this API. The token
    // is the identifier; the customer, when there is one, is an attribute of it.
    //
    // `authenticated` is switched off explicitly when there is no bearer token,
    // rather than left to default. Defaulted, the caller would fall back to
    // reading the session COOKIE — which on an app request does not exist, so
    // an anonymous device would be answered 401 instead of registered.
    authenticated: auth !== null,
    token: auth ?? undefined,
    body: { device_token: token, platform },
  });

  // A failure to register must not read as a failure to the app — there is
  // nothing a shopper can do about it and nothing to tell them. The app retries
  // on its next cold start, which is the right cadence for this.
  if (status !== 200 && status !== 201) {
    console.error("[kandi-push] device registration failed:", status);
    return appAuthJson({ registered: false }, 200);
  }

  return appAuthJson({ registered: true, ...(data as object) }, 200);
}
