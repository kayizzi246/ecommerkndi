import { callSellerApi, setSellerCookie } from "@/lib/seller-server";

/**
 * Exchanges the six-digit code emailed at sign-up for a seller session.
 *
 * Verifying signs the seller straight in — the alternative is asking somebody
 * to type the password they chose ninety seconds earlier, which is how you lose
 * a seller between registering and their first listing.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string };

  if (!body.email || !body.code) {
    return Response.json({ message: "Enter the code we emailed you." }, { status: 400 });
  }

  const { status, data } = await callSellerApi("/verify", {
    method: "POST",
    authenticated: false,
    body: { email: body.email, code: body.code },
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
