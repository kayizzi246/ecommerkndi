import { appAuthJson, appTooManyRequests } from "@/lib/app-auth";
import { appPreflight } from "@/lib/app-api";
import { callCustomerApi } from "@/lib/customer-server";
import { clientIp, rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/app/auth/forgot
 *
 * Asks WordPress to email a password reset link.
 *
 * ---- The one email this flow keeps, and why ----
 *
 * Sign-up no longer sends anything. This does, and it has to: the whole point
 * of a reset is proving that the person asking can read the inbox the account
 * is registered to. An email here is not friction in the way a sign-up code
 * is — the shopper is already stuck, and the message is what unsticks them.
 *
 * It sends a LINK to the website rather than a code to type back into the app.
 * A code means a shopper switching apps twice while copying six digits from a
 * mail client; a link means one tap from the message straight into the page
 * that sets the password. It also means there is no code-entry screen in the
 * app to build, get wrong, or rate-limit separately.
 *
 * Answers the same way whether or not the address has an account. That is not
 * politeness — a reply that differed would let anybody test addresses against
 * this endpoint and learn which ones shop here.
 */
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return appPreflight();
}

export async function POST(request: Request) {
  // A reset endpoint sends mail to an address the caller chooses, which makes
  // it usable to bombard somebody else's inbox from our domain. WordPress
  // applies its own ceiling, but that one is per account; this is per source,
  // so a script cannot walk a list of addresses one message each.
  const limit = rateLimit("password-reset", clientIp(request), LIMITS.passwordReset);
  if (!limit.ok) return appTooManyRequests(limit.retryAfterSeconds);

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
    return appAuthJson({ message }, 429);
  }

  return appAuthJson({
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  });
}
