import { callCustomerApi } from "@/lib/customer-server";
import { privateJson } from "@/lib/private-json";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/**
 * Asks WordPress to email a password reset link.
 *
 * Answers the same way whether or not the address has an account. That is not
 * politeness — a reply that differed would let anybody test addresses against
 * this endpoint and learn which ones shop here.
 */
export async function POST(request: Request) {
  // A reset endpoint sends an email to an address the caller chooses, which
  // makes it usable as a way to bombard somebody else's inbox from our domain.
  // WordPress applies its own ceiling — handled below — but that one is per
  // account; this one is per source, so a script cannot simply walk a list of
  // addresses one message each.
  const limit = rateLimit("password-reset", clientIp(request), LIMITS.passwordReset);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim();

  const { status, data } = await callCustomerApi("/password/forgot", {
    method: "POST",
    authenticated: false,
    body: { email },
  });

  // 429 is the one case worth passing through honestly: somebody who has asked
  // three times in ten minutes needs to be told to wait, not left believing a
  // fourth email is coming.
  if (status === 429) {
    const message =
      (data as { message?: string })?.message ??
      "Too many attempts. Please wait a few minutes and try again.";
    return privateJson({ message }, { status: 429 });
  }

  return privateJson({
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  });
}
