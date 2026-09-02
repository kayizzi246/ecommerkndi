import { callSellerApi, setSellerCookie } from "@/lib/seller-server";
import { privateJson } from "@/lib/private-json";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/**
 * Sets a new password from an emailed key, and signs the seller straight in.
 *
 * Making somebody who has just proved they own the address type the password
 * they set ten seconds ago is friction with nothing behind it — so this hands
 * back a session in the same httpOnly cookie the sign-in route uses, rather
 * than bouncing them to the sign-in form.
 */
export async function POST(request: Request) {
  const throttled = rateLimit("seller-reset:ip", clientIp(request), LIMITS.signIn);
  if (!throttled.ok) return tooManyRequests(throttled.retryAfterSeconds);

  const { key, login, password } = (await request.json().catch(() => ({}))) as {
    key?: string;
    login?: string;
    password?: string;
  };

  if (!key || !login || !password) {
    return privateJson(
      { message: "That reset link is not valid. Please request a new one." },
      { status: 400 }
    );
  }

  const { status, data } = await callSellerApi("/password/reset", {
    method: "POST",
    authenticated: false,
    body: { key, login, password },
  });

  if (status !== 200) {
    return privateJson(data, { status });
  }

  const payload = data as { token?: string; expires_in?: number; seller?: unknown };
  if (!payload.token) {
    return privateJson({ message: "The backend did not return a session token." }, { status: 502 });
  }

  await setSellerCookie(payload.token, payload.expires_in ?? 60 * 60 * 24 * 14);

  return privateJson({ seller: payload.seller });
}
