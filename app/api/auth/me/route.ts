import { callCustomerApi } from "@/lib/customer-server";
import { privateJson } from "@/lib/private-json";

/**
 * Never prerendered, never revalidated: the answer depends entirely on the
 * session cookie, so a shared build-time copy would belong to nobody.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const { status, data } = await callCustomerApi("/me");
  return privateJson(data, { status });
}
