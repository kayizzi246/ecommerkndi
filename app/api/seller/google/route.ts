import { verifyGoogleIdToken, GoogleAuthError } from "@/lib/google-verify";
import { callSellerApi, setSellerCookie } from "@/lib/seller-server";

/**
 * Google sign-in for the Seller Centre. Unlike the shopper flow this never
 * creates an account — the email must already belong to a registered seller,
 * because stores go through review before they can trade.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { credential?: string };

  if (!body.credential) {
    return Response.json({ message: "Missing Google credential." }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(body.credential);
  } catch (error) {
    const message = error instanceof GoogleAuthError ? error.message : "Google sign-in failed.";
    return Response.json({ message }, { status: 401 });
  }

  const { status, data } = await callSellerApi("/google", {
    method: "POST",
    authenticated: false,
    body: { email: identity.email, google_id: identity.sub },
  });

  if (status !== 200) {
    return Response.json(data, { status });
  }

  const payload = data as { token?: string; expires_in?: number; seller?: unknown };
  if (!payload.token) {
    return Response.json({ message: "The backend did not return a session." }, { status: 502 });
  }

  await setSellerCookie(payload.token, payload.expires_in ?? 60 * 60 * 24 * 14);

  return Response.json({ seller: payload.seller });
}
