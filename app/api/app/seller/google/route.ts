import { verifyGoogleIdToken, GoogleAuthError } from "@/lib/google-verify";
import { callSellerApi } from "@/lib/seller-server";
import { appAuthJson, appTooManyRequests } from "@/lib/app-auth";
import { appPreflight } from "@/lib/app-api";
import { clientIp, rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/app/seller/google
 *
 * Google sign-in for the Seller Centre, from the phone.
 *
 * The app twin of `/api/seller/google`. Same verification, same WordPress
 * endpoint, same rule that this NEVER creates an account — the address must
 * already belong to a registered seller, because stores go through review
 * before they can trade. The only difference is where the session goes: that
 * route sets an httpOnly cookie, this returns the bearer token in the body,
 * because Dart's HTTP client keeps no cookie jar.
 *
 * ---- The credential is verified here, not trusted ----
 *
 * The app sends the raw Google ID token and this checks it against Google's own
 * signing keys before anything else happens. That is the whole security of the
 * route: the email comes out of the VERIFIED token, never out of the request
 * body, so a caller cannot sign in as somebody else by editing a field.
 *
 * ---- kandi_not_seller is not an error ----
 *
 * A Google account with no store behind it comes back with that code, and the
 * app reads it as "this person wants to open one" rather than as a failure —
 * it carries the same credential straight into the sign-up screen so they do
 * not have to press the Google button twice.
 */
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return appPreflight();
}

export async function POST(request: Request) {
  // Shares the website's seller sign-in budget on purpose. A separate one for
  // the app would hand an attacker a second set of attempts per account.
  const ip = clientIp(request);
  const bySource = rateLimit("seller-signin:ip", ip, LIMITS.signIn);
  if (!bySource.ok) return appTooManyRequests(bySource.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as {
    credential?: string;
  };

  if (!body.credential) {
    return appAuthJson({ message: "Missing Google credential." }, 400);
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(body.credential);
  } catch (error) {
    const message =
      error instanceof GoogleAuthError ? error.message : "Google sign-in failed.";
    return appAuthJson({ message }, 401);
  }

  const byAccount = rateLimit(
    "seller-signin:email",
    identity.email.toLowerCase(),
    LIMITS.signIn
  );
  if (!byAccount.ok) return appTooManyRequests(byAccount.retryAfterSeconds);

  const { status, data } = await callSellerApi("/google", {
    method: "POST",
    authenticated: false,
    body: { email: identity.email, google_id: identity.sub },
  });

  if (status !== 200) {
    // Passed through untouched, including `kandi_not_seller` — see the note
    // above. The app needs the code, not a flattened message.
    return appAuthJson(data, status);
  }

  const payload = data as {
    token?: string;
    expires_in?: number;
    seller?: unknown;
  };
  if (!payload.token) {
    return appAuthJson({ message: "The backend did not return a session." }, 502);
  }

  return appAuthJson({
    token: payload.token,
    expires_in: payload.expires_in ?? 60 * 60 * 24 * 14,
    seller: payload.seller ?? null,
  });
}
