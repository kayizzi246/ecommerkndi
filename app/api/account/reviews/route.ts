import { callCustomerApi } from "@/lib/customer-server";

/** Every review the signed-in shopper has written, newest first. */
export async function GET() {
  const { status, data } = await callCustomerApi("/reviews");
  return Response.json(data, { status });
}
