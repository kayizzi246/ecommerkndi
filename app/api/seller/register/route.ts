import { callSellerApi, setSellerCookie, clearSellerCookie } from "@/lib/seller-server";
import { privateJson } from "@/lib/private-json";
import { verifyGoogleIdToken, GoogleAuthError } from "@/lib/google-verify";

/** Always required, however the seller signed up. */
const REQUIRED = ["store_name", "owner_name", "phone"] as const;

/**
 * Public seller sign-up. New accounts land in WordPress as `pending` for review.
 *
 * Two ways in. With a password, the address is unproven and WordPress emails a
 * six-digit code before the account works. With a Google credential, the token
 * is verified here against Google's own signing keys — a second time, since the
 * onboarding form already read it to fill itself in — and the address it
 * carries is used in place of whatever the form submitted.
 *
 * Taking the email from the token rather than the payload is the whole security
 * of this route: it means a caller cannot open a store on somebody else's
 * address by editing a form field, because the address never comes from the
 * form at all.
 */
export async function POST(request: Request) {
  /**
   * Whoever this browser was, it is not them any more.
   *
   * Unconditional, and before WordPress is called at all. This used to happen
   * only on a successful password sign-up, which left the exact case that
   * caused the trouble: a sign-up that *failed* — a taken address, a short
   * password, a dropped connection — returned an error to the form and left the
   * previous seller's cookie sitting in the browser. The person then navigated
   * to /seller and was shown a store that was never theirs, having just been
   * told their registration did not work.
   *
   * Clearing first makes the rule simple enough to reason about: posting a
   * sign-up ends the old session, whatever happens next. The only way to hold a
   * seller session after this line is to be issued a new one — below, by a
   * Google sign-up, or by entering the emailed code.
   */
  await clearSellerCookie();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const missing = REQUIRED.filter((field) => !body[field]);
  if (missing.length > 0) {
    return privateJson(
      { message: `Missing required field(s): ${missing.join(", ")}.` },
      { status: 400 }
    );
  }

  const credential = typeof body.google_credential === "string" ? body.google_credential : "";
  const payload: Record<string, unknown> = { ...body };
  delete payload.google_credential;

  if (credential) {
    try {
      const identity = await verifyGoogleIdToken(credential);
      payload.email = identity.email;
      payload.google_id = identity.sub;
      // WordPress generates its own unusable password for a Google account;
      // anything the form happened to hold is not passed on.
      delete payload.password;
    } catch (error) {
      const message = error instanceof GoogleAuthError ? error.message : "Google sign-in failed.";
      return privateJson({ message }, { status: 401 });
    }
  } else if (!body.email || !body.password) {
    return privateJson(
      { message: "Missing required field(s): email, password." },
      { status: 400 }
    );
  }

  const { status, data } = await callSellerApi("/register", {
    method: "POST",
    authenticated: false,
    body: payload,
  });

  if (status !== 200) {
    return privateJson(data, { status });
  }

  /**
   * Registration now always comes back with a session, whichever way the seller
   * signed up, so the new store is signed in the moment it exists. It used to
   * arrive without one on the password path, which left the account waiting on
   * an emailed code — and unreachable for good if that email never arrived.
   */
  const session = data as { token?: string; expires_in?: number; seller?: unknown };

  if (session.token) {
    await setSellerCookie(session.token, session.expires_in ?? 60 * 60 * 24 * 14);
  }

  /**
   * The token goes in the httpOnly cookie and nowhere else.
   *
   * Passing WordPress's reply straight through would put it in a JSON body that
   * any script on the page can read, which is the whole thing the cookie flag
   * exists to prevent. Only the seller object crosses back — the same shape the
   * sign-in route returns.
   */
  return privateJson({ seller: session.seller }, { status });
}
