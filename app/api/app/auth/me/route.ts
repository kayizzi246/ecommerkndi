import { appAuthJson, appBearerToken } from "@/lib/app-auth";
import { APP_WRITE_CORS_HEADERS } from "@/lib/app-api";
import { callCustomerApi } from "@/lib/customer-server";

/**
 * GET /api/app/auth/me
 *
 * Who the phone is signed in as, according to WordPress.
 *
 * ---- What this is for ----
 *
 * The app holds a token for thirty days, which is a long time for something to
 * silently stop being true: the shopper may have changed their password on the
 * website, the account may have been closed, the token may simply have expired
 * while the phone was off. The app cannot tell any of that by looking at the
 * string it saved.
 *
 * So it asks, once, on launch. A 200 means the session is real and the name
 * and email come back fresh — which is also how a name changed on the website
 * reaches the app. A 401 means the token is dead and the app clears it, so the
 * shopper meets the sign-in screen instead of a checkout that fails at the
 * last step for reasons it cannot explain.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...APP_WRITE_CORS_HEADERS,
      // The only route here read with GET, so the preflight has to say so.
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    },
  });
}

export async function GET(request: Request) {
  const token = appBearerToken(request);

  // Answered without troubling WordPress. A request with no token is not a
  // failed sign-in, it is an app that has never signed in — the commonest
  // case there is, and one round trip to a shared host in Uganda is worth
  // saving on every cold start.
  if (!token) {
    return appAuthJson({ message: "Not signed in." }, 401);
  }

  const { status, data } = await callCustomerApi("/me", { token });

  return appAuthJson(data, status);
}
