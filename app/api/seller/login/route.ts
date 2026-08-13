import { callSellerApi, setSellerCookie } from "@/lib/seller-server";
import { privateJson } from "@/lib/private-json";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/** Exchanges seller credentials for a session token stored in an httpOnly cookie. */
export async function POST(request: Request) {
  // A seller account is worth more to an attacker than a shopper account: it
  // can change prices, publish listings and request payouts. Same two-key
  // throttle as the shopper sign-in — by source, and by the account under
  // attack — because a botnet defeats the first one alone.
  const ip = clientIp(request);
  const bySource = rateLimit("seller-signin:ip", ip, LIMITS.signIn);
  if (!bySource.ok) return tooManyRequests(bySource.retryAfterSeconds);

  const body = await request.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return privateJson({ message: "Email and password are required." }, { status: 400 });
  }

  const byAccount = rateLimit("seller-signin:email", email.toLowerCase(), LIMITS.signIn);
  if (!byAccount.ok) return tooManyRequests(byAccount.retryAfterSeconds);

  const { status, data } = await callSellerApi("/login", {
    method: "POST",
    authenticated: false,
    body: { email, password },
  });

  if (status !== 200) {
    return privateJson(data, { status });
  }

  const payload = data as { token?: string; expires_in?: number; seller?: unknown };
  if (!payload.token) {
    return privateJson({ message: "The backend did not return a session token." }, { status: 502 });
  }

  await setSellerCookie(payload.token, payload.expires_in ?? 60 * 60 * 24 * 14);

  return privateJson({ seller: payload.seller });
}
