import { verifyGoogleIdToken, GoogleAuthError } from "@/lib/google-verify";
import { privateJson } from "@/lib/private-json";
import { callCustomerApi, setCustomerCookie } from "@/lib/customer-server";

/**
 * Exchanges a Google ID token for a Kandi shopper session.
 *
 * The token is verified with Google first, so WordPress only ever receives an
 * email address we have proof of.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { credential?: string };

  if (!body.credential) {
    return privateJson({ message: "Missing Google credential." }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(body.credential);
  } catch (error) {
    const message =
      error instanceof GoogleAuthError ? error.message : "Google sign-in failed.";
    return privateJson({ message }, { status: 401 });
  }

  const { status, data } = await callCustomerApi("/google", {
    method: "POST",
    authenticated: false,
    body: {
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
      google_id: identity.sub,
    },
  });

  if (status !== 200) {
    return privateJson(data, { status });
  }

  const payload = data as { token?: string; expires_in?: number; customer?: unknown };
  if (!payload.token) {
    return privateJson({ message: "The backend did not return a session." }, { status: 502 });
  }

  await setCustomerCookie(payload.token, payload.expires_in ?? 60 * 60 * 24 * 30);

  return privateJson({ customer: payload.customer });
}
