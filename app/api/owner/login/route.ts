import { callOwnerApi, setOwnerCookie } from "@/lib/owner-server";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/**
 * Owner sign-in.
 *
 * The passcode is not checked here — it is sent straight to WordPress, which
 * holds the real value and compares it in constant time. Only once WordPress
 * has accepted it does it go into the httpOnly cookie, so a wrong passcode
 * never leaves a half-signed-in state behind.
 */
export async function POST(request: Request) {
  // The most valuable credential on the site, and a single passcode rather than
  // an email-and-password pair — so there is no username to guess and the whole
  // secret is one guessable string. That makes a ceiling on attempts the main
  // thing standing between a determined stranger and the product manager.
  //
  // There is no per-account key here because there is only one account: the
  // source address is the only thing to throttle on.
  const limit = rateLimit("owner-signin", clientIp(request), LIMITS.signIn);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as { passcode?: unknown };
  const passcode = typeof body.passcode === "string" ? body.passcode.trim() : "";

  if (!passcode) {
    return Response.json({ message: "Enter your owner passcode." }, { status: 400 });
  }

  const { status, data } = await callOwnerApi("/me", { passcode });

  if (status !== 200) {
    return Response.json(data, { status });
  }

  // The session cookie is encrypted, and encryption needs a key. A server with
  // no session secret cannot start a session, and saying so is better than the
  // alternative it replaced — writing the passcode into the browser in plain
  // text because the safe path was unavailable.
  if (!(await setOwnerCookie(passcode))) {
    console.error(
      "[kandi-owner] cannot seal the owner session — set KANDI_SESSION_SECRET " +
        "(or KANDI_API_SECRET) in the environment."
    );
    return Response.json(
      { message: "The shop is not configured to hold a sign-in. Please contact support." },
      { status: 503 }
    );
  }

  return Response.json(data, { status: 200 });
}
