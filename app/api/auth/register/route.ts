import { completeCustomerSession } from "@/lib/customer-auth";
import { privateJson } from "@/lib/private-json";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/** Creates a shopper account from an email address and a password. */
export async function POST(request: Request) {
  // Unthrottled account creation is how a shop acquires ten thousand junk
  // customers overnight — each one a row in WordPress and, because registration
  // sends mail, a message from our domain. Enough spam sent on our behalf and
  // the shop's real order confirmations start landing in junk folders, which is
  // the expensive part.
  const limit = rateLimit("register", clientIp(request), LIMITS.register);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
  };

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();

  if (!email) {
    return privateJson({ message: "Enter your email address." }, { status: 400 });
  }

  // Checked here as well as in WordPress. The same rule enforced in both
  // places means the shopper is told immediately, rather than after a round
  // trip, while the server still refuses anything that arrives another way.
  if (password.length < 8) {
    return privateJson(
      { message: "Use at least 8 characters for your password." },
      { status: 400 }
    );
  }

  return completeCustomerSession("/register", { email, password, name });
}
