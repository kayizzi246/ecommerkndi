import { callSellerApi } from "@/lib/seller-server";
import { verifyGoogleIdToken, GoogleAuthError } from "@/lib/google-verify";
import { appAuthJson, appTooManyRequests } from "@/lib/app-auth";
import { appPreflight } from "@/lib/app-api";
import { clientIp, rateLimit, LIMITS } from "@/lib/rate-limit";

/** Always required, however the seller signed up. Same three as the website. */
const REQUIRED = ["store_name", "owner_name", "phone"] as const;

/**
 * POST /api/app/seller/register
 *
 * Opening a store from the phone. New accounts land in WordPress as `pending`
 * for review, exactly as they do from the website.
 *
 * ---- Why this exists, when the app could have linked out ----
 *
 * The app's seller sign-in used to end with a sentence telling people to go to
 * kandiug.com to register. That is a funnel with a browser switch in the middle
 * of it, on the screen where somebody has already decided to sell — and on a
 * phone it means retyping an address into Chrome, signing in again there, and
 * coming back. Most people do not come back.
 *
 * ---- Two ways in, and the email is taken from the token ----
 *
 * With a password, the address is unproven and WordPress emails a six-digit
 * code before the account works. With a Google credential, the token is
 * verified here against Google's own signing keys and the address it carries is
 * used INSTEAD OF whatever the form submitted.
 *
 * That substitution is the security of this route, and it is worth being
 * explicit: a caller cannot open a store on somebody else's address by editing
 * a form field, because on the Google path the address never comes from the
 * form at all.
 *
 * ---- What this route does NOT do ----
 *
 * It does not collect documents or take the joining fee. Both live in the
 * onboarding gate on the website, which the dashboard cannot be reached past,
 * and duplicating either here would be a second compliance flow to keep in step
 * with the first. The app creates the account; the gate still decides when it
 * can trade.
 */
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return appPreflight();
}

export async function POST(request: Request) {
  // Sign-UP is throttled harder than sign-in by source alone, because there is
  // no account to key the second budget on — the whole point of the request is
  // that one does not exist yet.
  const ip = clientIp(request);
  const limit = rateLimit("seller-register:ip", ip, LIMITS.signIn);
  if (!limit.ok) return appTooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const missing = REQUIRED.filter((field) => {
    const value = body[field];
    return typeof value !== "string" || value.trim().length === 0;
  });
  if (missing.length > 0) {
    return appAuthJson(
      { message: `Missing: ${missing.join(", ")}.`, fields: missing },
      400
    );
  }

  const payload: Record<string, unknown> = {
    store_name: String(body.store_name).trim(),
    owner_name: String(body.owner_name).trim(),
    phone: String(body.phone).trim(),
    city: typeof body.city === "string" ? body.city.trim() : "",
    category: typeof body.category === "string" ? body.category.trim() : "",
  };

  const credential = typeof body.google_credential === "string"
    ? body.google_credential
    : null;

  if (credential) {
    let identity;
    try {
      identity = await verifyGoogleIdToken(credential);
    } catch (error) {
      const message =
        error instanceof GoogleAuthError ? error.message : "Google sign-up failed.";
      return appAuthJson({ message }, 401);
    }
    // From the VERIFIED token, never from the body — see the note above.
    payload.email = identity.email;
    payload.google_id = identity.sub;
  } else {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return appAuthJson({ message: "Enter a valid email address." }, 400);
    }
    // Checked on the way IN, unlike sign-in where a short legacy password must
    // still work. This is where a new one is chosen, so this is where the rule
    // belongs.
    if (password.length < 8) {
      return appAuthJson(
        { message: "Choose a password of at least 8 characters." },
        400
      );
    }
    payload.email = email;
    payload.password = password;
  }

  const { status, data } = await callSellerApi("/register", {
    method: "POST",
    authenticated: false,
    body: payload,
  });

  if (status !== 200 && status !== 201) {
    return appAuthJson(data, status);
  }

  const result = data as {
    token?: string;
    expires_in?: number;
    seller?: unknown;
    requires_verification?: boolean;
  };

  // A Google sign-up is signed in immediately — the address is already proven.
  // A password sign-up is NOT: WordPress has emailed a code, and there is no
  // session until it comes back. Both shapes are returned honestly rather than
  // faking a token, so the app knows which screen to show next.
  return appAuthJson({
    token: result.token ?? null,
    expires_in: result.expires_in ?? 60 * 60 * 24 * 14,
    seller: result.seller ?? null,
    requires_verification: result.token ? false : true,
  });
}
