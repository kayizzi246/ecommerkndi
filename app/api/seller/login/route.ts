import { callSellerApi, setSellerCookie } from "@/lib/seller-server";

/** Exchanges seller credentials for a session token stored in an httpOnly cookie. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return Response.json({ message: "Email and password are required." }, { status: 400 });
  }

  const { status, data } = await callSellerApi("/login", {
    method: "POST",
    authenticated: false,
    body: { email, password },
  });

  if (status !== 200) {
    return Response.json(data, { status });
  }

  const payload = data as { token?: string; expires_in?: number; seller?: unknown };
  if (!payload.token) {
    return Response.json({ message: "The backend did not return a session token." }, { status: 502 });
  }

  await setSellerCookie(payload.token, payload.expires_in ?? 60 * 60 * 24 * 14);

  return Response.json({ seller: payload.seller });
}
