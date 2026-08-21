import { appSession, appAuthJson, appTooManyRequests } from "@/lib/app-auth";
import { appPreflight } from "@/lib/app-api";
import { clientIp, rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/app/auth/login
 *
 * Signs a shopper in from the phone, against the same WordPress accounts the
 * website uses. Returns the bearer token rather than setting a cookie — see
 * the note at the head of `lib/app-auth.ts`.
 */
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return appPreflight();
}

export async function POST(request: Request) {
  // Throttled on the source address *and* on the account being tried, exactly
  // as the website's route is, and the reasoning is the same: per-IP alone
  // stops one machine grinding through a password list, per-account alone
  // stops a botnet spreading that attack over a thousand addresses, each one
  // under the per-IP ceiling. Neither is sufficient by itself.
  //
  // Sharing the limiter KEYS with the website is deliberate. A separate budget
  // for the app endpoint would simply have handed an attacker a second set of
  // attempts against every account.
  const ip = clientIp(request);
  const bySource = rateLimit("signin:ip", ip, LIMITS.signIn);
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

  // Lower-cased so `Sam@…` and `sam@…` share one budget rather than doubling it.
  const byAccount = rateLimit("signin:email", email.toLowerCase(), LIMITS.signIn);
  if (!byAccount.ok) return appTooManyRequests(byAccount.retryAfterSeconds);

  // The password is not length-checked here. Rules belong on the way in, not
  // on the way back: an old account with a short password must still be able
  // to sign in, and telling somebody their existing password is "too short" at
  // the sign-in screen is a dead end with no action behind it.
  return appSession("/login", { email, password });
}
