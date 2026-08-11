import { callSellerApi, setSellerCookie } from "@/lib/seller-server";
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
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const missing = REQUIRED.filter((field) => !body[field]);
  if (missing.length > 0) {
    return Response.json(
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
      return Response.json({ message }, { status: 401 });
    }
  } else if (!body.email || !body.password) {
    return Response.json(
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
    return Response.json(data, { status });
  }

  // A Google sign-up comes back with a session, because Google has already
  // proved the address and there is no code step to wait for. The cookie is set
  // here so the new seller lands in their dashboard signed in.
  const session = data as { token?: string; expires_in?: number };
  if (session.token) {
    await setSellerCookie(session.token, session.expires_in ?? 60 * 60 * 24 * 14);
  }

  return Response.json(data, { status });
}
