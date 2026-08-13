import { completeCustomerSession } from "@/lib/customer-auth";
import { privateJson } from "@/lib/private-json";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/**
 * Sets a new password from the key in a reset email, and signs the shopper in.
 *
 * The key and login come straight from the emailed link and are not inspected
 * here — only WordPress can say whether a key is genuine, unexpired and unused,
 * and any check invented on this side would either duplicate that or contradict
 * it.
 */
export async function POST(request: Request) {
  // The reset key is the one secret standing between a stranger and somebody
  // else's account, and it is guessable in exactly the way a password is not
  // supposed to be: unlimited attempts against a known email address. WordPress
  // generates a long key, so this is not a realistic attack at full speed — but
  // it becomes one if the attacker is allowed to try forever.
  const limit = rateLimit("password-reset", clientIp(request), LIMITS.passwordReset);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as {
    key?: string;
    login?: string;
    password?: string;
  };

  const key = body.key ?? "";
  const login = body.login ?? "";
  const password = body.password ?? "";

  if (!key || !login) {
    return privateJson(
      { message: "That reset link is not valid. Please request a new one." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return privateJson(
      { message: "Use at least 8 characters for your password." },
      { status: 400 }
    );
  }

  return completeCustomerSession("/password/reset", { key, login, password });
}
