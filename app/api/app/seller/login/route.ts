import { callSellerApi } from "@/lib/seller-server";
import { appAuthJson, appTooManyRequests } from "@/lib/app-auth";
import { appPreflight } from "@/lib/app-api";
import { clientIp, rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/app/seller/login
 *
 * Signs a SELLER in from the phone, against the same WordPress accounts the
 * Seller Centre on the website uses.
 *
 * ---- Why this exists next to /api/seller/login ----
 *
 * The website's route puts the session token in an httpOnly cookie and returns
 * only the seller record. That is the right shape for a browser and useless to
 * the app: Dart's HTTP client keeps no cookie jar, so the sign-in would succeed
 * and be forgotten before the next request.
 *
 * So this one hands the token back in the body, exactly as
 * `/api/app/auth/login` already does for shoppers — one convention for the app,
 * one for the web, and `callSellerApi` shared underneath so the two cannot
 * drift apart in how they talk to WordPress.
 */
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return appPreflight();
}

export async function POST(request: Request) {
  // The same two-key throttle the website's seller sign-in uses, and sharing
  // its KEYS on purpose. A seller account can change prices, publish listings
  // and request payouts, so it is worth more to an attacker than a shopper's —
  // and a separate budget for the app endpoint would simply hand them a second
  // set of attempts against every account.
  const ip = clientIp(request);
  const bySource = rateLimit("seller-signin:ip", ip, LIMITS.signIn);
  if (!bySource.ok) return appTooManyRequests(bySource.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return appAuthJson({ message: "Enter your email and your password." }, 400);
  }

  const byAccount = rateLimit("seller-signin:email", email.toLowerCase(), LIMITS.signIn);
  if (!byAccount.ok) return appTooManyRequests(byAccount.retryAfterSeconds);

  const { status, data } = await callSellerApi("/login", {
    method: "POST",
    authenticated: false,
    body: { email, password },
  });

  if (status !== 200) {
    return appAuthJson(data, status);
  }

  const payload = data as {
    token?: string;
    expires_in?: number;
    seller?: unknown;
  };

  if (!payload.token) {
    return appAuthJson(
      { message: "The backend did not return a session token." },
      502
    );
  }

  // The token IS the answer here, unlike the web route where it is a cookie the
  // client never sees. `expires_in` travels with it so the app can expire the
  // session on its own clock rather than discovering it is signed out halfway
  // through a payout request.
  return appAuthJson({
    token: payload.token,
    expires_in: payload.expires_in ?? 60 * 60 * 24 * 14,
    seller: payload.seller ?? null,
  });
}
