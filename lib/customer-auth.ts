import { callCustomerApi, setCustomerCookie } from "@/lib/customer-server";

/**
 * The shape WordPress hands back whenever a shopper proves who they are —
 * registering, signing in, or finishing a password reset.
 */
type SessionPayload = {
  token?: string;
  expires_in?: number;
  customer?: unknown;
  message?: string;
};

/**
 * Turns a WordPress reply into a signed-in browser.
 *
 * All four ways into an account end identically: WordPress issues a token, and
 * that token has to reach the browser as an httpOnly cookie rather than as
 * JSON. Keeping it out of JavaScript is the point — a token a script can read
 * is a token any injected script can steal, and this one is good for thirty
 * days of somebody's order history and saved addresses.
 *
 * Shared by register, login and reset so the three cannot drift apart. A route
 * that forgot to set the cookie would appear to work — WordPress would say yes
 * — and the shopper would land back on the sign-in form with no explanation.
 */
export async function completeCustomerSession(
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
    // WordPress writes these messages for shoppers, not for developers — "that
    // email and password do not match", "use at least 8 characters" — so they
    // are passed through rather than replaced with something vaguer.
    return Response.json(
      { message: payload.message ?? "Could not sign you in. Please try again." },
      { status: status === 200 ? 502 : status }
    );
  }

  await setCustomerCookie(payload.token, payload.expires_in ?? 60 * 60 * 24 * 30);

  return Response.json({ customer: payload.customer });
}
