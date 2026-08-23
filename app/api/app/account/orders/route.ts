import { appAuthJson, appBearerToken } from "@/lib/app-auth";
import { APP_WRITE_CORS_HEADERS } from "@/lib/app-api";
import { callCustomerApi } from "@/lib/customer-server";

/**
 * GET /api/app/account/orders
 *
 * The signed-in shopper's order history, for the phone.
 *
 * ---- Why this exists next to /api/account/orders ----
 *
 * The website's version reads the session from an httpOnly cookie, which is
 * right for a browser and unusable from the app: Dart's HTTP client keeps no
 * cookie jar, so the app holds the WordPress token itself and sends it as an
 * `Authorization` header. Called with that header, `/api/account/orders` finds
 * no cookie and answers 401 to a shopper who is perfectly well signed in.
 *
 * The alternative was to send the app to the website for its own order
 * history, in an external browser that does not have the app's session — so a
 * shopper who is signed in on their phone would be asked to sign in again to
 * see the orders they placed on it. That is the kind of seam that makes one
 * shop feel like two.
 *
 * Same WordPress endpoint, same payload, same statuses as the website. This is
 * a different door onto the identical room, which is the whole arrangement the
 * `/api/app/*` routes exist to keep — see `lib/app-auth.ts`.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...APP_WRITE_CORS_HEADERS,
      // Read with GET, so the preflight has to say so — the shared headers
      // advertise POST, which is what the rest of the app routes are.
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    },
  });
}

export async function GET(request: Request) {
  const token = appBearerToken(request);

  // Answered without troubling WordPress, the same way `/api/app/auth/me`
  // does: a request with no token is not a failed lookup, it is an app that
  // has never signed in, and that round trip is worth saving on a Ugandan
  // mobile connection.
  if (!token) {
    return appAuthJson({ message: "Not signed in." }, 401);
  }

  const { status, data } = await callCustomerApi("/orders", { token });

  return appAuthJson(data, status);
}
