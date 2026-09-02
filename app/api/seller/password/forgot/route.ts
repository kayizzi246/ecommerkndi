import { callSellerApi } from "@/lib/seller-server";
import { privateJson } from "@/lib/private-json";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/**
 * Asks WordPress to email a seller a reset link.
 *
 * Answers the same way whether or not the address has a seller account — the
 * decision is WordPress's and this route does not get to see it either. A
 * different reply for an unknown address would make this a way to find out
 * which shops trade here and who runs them.
 */
export async function POST(request: Request) {
  const throttled = rateLimit("seller-forgot:ip", clientIp(request), LIMITS.signIn);
  if (!throttled.ok) return tooManyRequests(throttled.retryAfterSeconds);

  const { email } = (await request.json().catch(() => ({}))) as { email?: string };

  const { status, data } = await callSellerApi("/password/forgot", {
    method: "POST",
    authenticated: false,
    body: { email: email ?? "" },
  });

  return privateJson(data, { status });
}
