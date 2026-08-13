import { callCustomerApi, clearCustomerCookie } from "@/lib/customer-server";
import { privateJson } from "@/lib/private-json";

export async function POST() {
  // Invalidate server-side where possible, but always drop the cookie.
  await callCustomerApi("/logout", { method: "POST" });
  await clearCustomerCookie();
  return privateJson({ ok: true });
}
