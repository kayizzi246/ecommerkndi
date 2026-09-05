import { appAuthJson, appSession, appTooManyRequests } from "@/lib/app-auth";
import { appPreflight } from "@/lib/app-api";
import { openChallenge } from "@/lib/otp";
import { clientIp, rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * ---- Signing in with a code, not a password ----
 *
 * This is the app's only sign-in route. It takes the challenge handed out by
 * `/api/otp/start` and the six digits the shopper read off an SMS or an email,
 * and returns the same bearer-token session `/api/app/auth/login` used to
 * return before it was deleted.
 *
 * ---- Why the app does not call `/api/otp/verify` instead ----
 *
 * That route exists and it checks the same challenge, but it answers with a
 * `Set-Cookie` — it is the storefront's mechanism, and the storefront is a
 * browser with a cookie jar. The app has none: `http` in Dart drops set-cookies
 * on the floor, and building a jar around it to carry one sealed value would be
 * a second session mechanism sitting beside the bearer token the app already
 * has. So the proof is checked here and converted straight into the credential
 * the app actually uses.
 *
 * One consequence worth naming: the challenge is not consumed. `openChallenge`
 * is stateless — it opens a sealed value rather than striking a row off a table
 * — so the same challenge and code could be presented here twice inside the ten
 * minutes it lives. That is not a hole: presenting it twice needs the code,
 * which needs the phone, and the second session is a session for the same
 * shopper. What bounds guessing is the rate limit below and the one on
 * `/api/otp/start`, not single use.
 *
 * ---- What comes back ----
 *
 * `{ token, expiresIn, expiresAt, customer }`, from `appSession`. The account
 * behind it is found or created by WordPress from the proved contact — see
 * `/customers/otp-session` in `wordpress/kandi-customer-auth.php` — so a
 * shopper who has only ever bought over the phone gets an order history without
 * ever having chosen a password.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return appPreflight();
}

export async function POST(request: Request) {
  /* The same bucket sign-in used, and for the same reason: this route mints a
     session, so it is worth the same protection whatever the credential is. */
  const bySource = rateLimit("signin:ip", clientIp(request), LIMITS.signIn);
  if (!bySource.ok) return appTooManyRequests(bySource.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as {
    challenge?: unknown;
    code?: unknown;
    name?: unknown;
  };

  const destination = await openChallenge(body.challenge, body.code);

  if (!destination) {
    /* One message for a wrong code, an expired challenge and a tampered one —
       the same wording `/api/otp/verify` uses, and for the same reason: telling
       them apart tells a caller whether a challenge is still live, which is
       half of deciding whether to keep guessing. */
    return appAuthJson(
      { message: "That code is not right. Check it, or ask for a new one." },
      400
    );
  }

  /* A second bucket on the contact itself. The IP one above is what a single
     attacker trips; this is what stops a spread-out attempt on one number. */
  const byContact = rateLimit("signin:otp", destination.value, LIMITS.signIn);
  if (!byContact.ok) return appTooManyRequests(byContact.retryAfterSeconds);

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

  return appSession("/otp-session", {
    channel: destination.channel,
    contact: destination.value,
    name,
  });
}
