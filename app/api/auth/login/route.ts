import { completeCustomerSession } from "@/lib/customer-auth";
import { privateJson } from "@/lib/private-json";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/** Signs a shopper in with an email address and a password. */
export async function POST(request: Request) {
  // Throttled on the source address *and* on the account being tried.
  //
  // The two catch different attacks and neither is enough alone. Limiting by IP
  // stops one machine working through a password list against one account.
  // Limiting by email stops a botnet spreading the same attack over a thousand
  // addresses — each one under the per-IP ceiling, together unlimited — which
  // is how credential stuffing is actually done.
  const ip = clientIp(request);
  const bySource = rateLimit("signin:ip", ip, LIMITS.signIn);
  if (!bySource.ok) return tooManyRequests(bySource.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return privateJson({ message: "Enter your email and your password." }, { status: 400 });
  }

  // Lower-cased so `Sam@…` and `sam@…` share one budget rather than doubling it.
  const byAccount = rateLimit("signin:email", email.toLowerCase(), LIMITS.signIn);
  if (!byAccount.ok) return tooManyRequests(byAccount.retryAfterSeconds);

  // The password is not validated here beyond being present. Length rules
  // belong on the way in, not on the way back: an old account with a short
  // password must still be able to sign in, and telling somebody their
  // existing password is "too short" at the login screen is a dead end.
  return completeCustomerSession("/login", { email, password });
}
