import { callSellerApi, clearSellerCookie } from "@/lib/seller-server";

export async function POST() {
  // Best effort: tell WordPress to invalidate the token, then drop the cookie
  // regardless of the outcome so the browser session always ends.
  await callSellerApi("/logout", { method: "POST" });
  await clearSellerCookie();
  return Response.json({ ok: true });
}
