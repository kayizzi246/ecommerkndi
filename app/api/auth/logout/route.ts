import { callCustomerApi, clearCustomerCookie } from "@/lib/customer-server";

export async function POST() {
  // Invalidate server-side where possible, but always drop the cookie.
  await callCustomerApi("/logout", { method: "POST" });
  await clearCustomerCookie();
  return Response.json({ ok: true });
}
