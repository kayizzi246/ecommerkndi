import { callSellerApi } from "@/lib/seller-server";
import { privateJson } from "@/lib/private-json";

/**
 * Sends a fresh verification code.
 *
 * WordPress answers the same way whether or not the address has an unverified
 * seller account, and this passes that answer through unchanged — a route that
 * said "no such seller" would be a way to enumerate who trades here.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };

  if (!body.email) {
    return privateJson({ message: "An email address is required." }, { status: 400 });
  }

  const { status, data } = await callSellerApi("/verify/resend", {
    method: "POST",
    authenticated: false,
    body: { email: body.email },
  });

  return privateJson(data, { status });
}
