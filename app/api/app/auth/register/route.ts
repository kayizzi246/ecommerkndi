import { appSession, appAuthJson, appTooManyRequests } from "@/lib/app-auth";
import { appPreflight } from "@/lib/app-api";
import { clientIp, rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/app/auth/register
 *
 * Creates a shopper account from the phone and signs them straight in.
 *
 * ---- The step that is deliberately not here ----
 *
 * There is no emailed code and no "check your inbox to verify your account".
 * WordPress issues the session on the spot, so the shopper who tapped "Create
 * account" is signed in by the time the button finishes animating.
 *
 * The app's previous sign-up went through Supabase with email confirmation
 * switched on, which meant registering returned NO session: the shopper was
 * sent to their inbox, told to find a message, and had to come back. On a
 * Ugandan phone that is a real gauntlet — the mail may be on a webmail account
 * the shopper reads once a week, it may land in spam, and the app they were
 * mid-purchase in is now behind two app switches. Most of them do not come
 * back, and the ones who do have lost the basket they were carrying.
 *
 * What is lost by dropping it is confirmation that the address is reachable.
 * That is worth having, and it is worth having LATER: the address is verified
 * the first time it has to be — a password reset proves it, and so does an
 * order confirmation that arrives. Nothing here grants anything on the
 * strength of an unverified address; the account holds a basket and an order
 * history, both of which are the shopper's own to lose.
 */
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return appPreflight();
}

export async function POST(request: Request) {
  // Unthrottled account creation is how a shop acquires ten thousand junk
  // customers overnight — each one a row in WordPress and, because
  // registration sends mail, a message from our domain. Enough spam sent on
  // our behalf and the shop's real order confirmations start landing in junk
  // folders, which is the expensive part.
  const limit = rateLimit("register", clientIp(request), LIMITS.register);
  if (!limit.ok) return appTooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
  };

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();

  if (!email) {
    return appAuthJson({ message: "Enter your email address." }, 400);
  }

  // Checked here as well as in WordPress. The same rule enforced in both
  // places means the shopper is told immediately rather than after a round
  // trip, while the server still refuses anything that arrives another way.
  //
  // Eight, matching the website and the plugin. The app used to ask for six,
  // which meant a password accepted on the phone was rejected by the same
  // shop's website — one account system cannot have two minimums.
  if (password.length < 8) {
    return appAuthJson(
      { message: "Use at least 8 characters for your password." },
      400
    );
  }

  return appSession("/register", { email, password, name });
}
