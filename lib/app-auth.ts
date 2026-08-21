import { callCustomerApi } from "@/lib/customer-server";
import { APP_WRITE_CORS_HEADERS } from "@/lib/app-api";

/**
 * Sign-in for the phone app.
 *
 * ---- Why these routes exist at all, next to /api/auth/* ----
 *
 * The website's auth routes end by putting the WordPress token into an
 * httpOnly cookie and returning only the customer. That is exactly right for a
 * browser — a token JavaScript can read is a token any injected script can
 * steal — and it is unusable from the app, which has no cookie jar and no
 * browser to set one in. Dart's `http` client does not persist cookies at all,
 * so the app would sign in successfully and be signed out again on the very
 * next request.
 *
 * So the app gets the same WordPress session, handed over the way a native
 * client can actually hold it: the bearer token in the JSON body, stored on
 * the device and sent as an `Authorization` header afterwards. The threat the
 * cookie defends against — a script on our own page reading the token — has no
 * counterpart inside an installed app.
 *
 * Everything else is shared. Same `callCustomerApi`, same WordPress endpoints,
 * same rate limits, same shopper-facing error text. A password changed on the
 * website works in the app on the next sign-in, because there is one account
 * system and this is a second door into it rather than a second lock.
 */

/** WordPress's reply to any of the four ways of proving who you are. */
type SessionPayload = {
  token?: string;
  expires_in?: number;
  customer?: unknown;
  message?: string;
};

/**
 * JSON with the CORS headers the app's other write routes carry.
 *
 * `no-store` on every one of these. An auth reply cached anywhere — a CDN, a
 * proxy on a Ugandan mobile network — is one shopper's session handed to the
 * next person who asks.
 */
export function appAuthJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      ...APP_WRITE_CORS_HEADERS,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/**
 * The 429, in the app's own envelope.
 *
 * `tooManyRequests` from the rate limiter is not reused: it answers with the
 * website's headers and no CORS, so the app — which may be running as a web
 * build on another origin — would see a network error where it should see
 * "wait a minute and try again". A shopper told nothing taps the button
 * harder, which is the one response that makes it worse.
 *
 * The wait is stated in minutes because that is the unit somebody decides with.
 * "Retry after 412 seconds" is arithmetic homework at the moment of most
 * frustration.
 */
export function appTooManyRequests(retryAfterSeconds: number): Response {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return appAuthJson(
    {
      message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      retryAfterSeconds,
    },
    429
  );
}

/**
 * The bearer token on an incoming app request, or null.
 *
 * Tolerates a bare token as well as `Bearer <token>`: it costs one line here
 * and saves a class of bug that presents as "signed in on the phone, 401 from
 * the server" with nothing in between to point at it.
 */
export function appBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const value = header.replace(/^Bearer\s+/i, "").trim();
  return value.length > 0 ? value : null;
}

/**
 * Turns a WordPress reply into a session the app can hold.
 *
 * The mirror of the website's `completeCustomerSession`, and deliberately the
 * same shape of function for the same reason: register, sign-in and reset all
 * end here, so the three cannot drift apart into three slightly different
 * ideas of what a successful sign-in returns.
 *
 * `expiresAt` is sent as well as `expiresIn`. A phone can be asleep for a
 * fortnight between the reply and the next launch, so a duration counted from
 * "now" is meaningless by the time the app reads it; an absolute instant is
 * not.
 */
export async function appSession(
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const { status, data } = await callCustomerApi(path, {
    method: "POST",
    authenticated: false,
    body,
  });

  const payload = (data ?? {}) as SessionPayload;

  if (status !== 200 || !payload.token) {
    // WordPress writes these for shoppers, not for developers — "that email
    // and password do not match", "use at least 8 characters" — so they are
    // passed through rather than replaced with something vaguer.
    return appAuthJson(
      { message: payload.message ?? "Could not sign you in. Please try again." },
      status === 200 ? 502 : status
    );
  }

  const expiresIn = payload.expires_in ?? 60 * 60 * 24 * 30;

  return appAuthJson({
    token: payload.token,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    customer: payload.customer ?? null,
  });
}
