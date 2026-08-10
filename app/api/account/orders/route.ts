import { callCustomerApi } from "@/lib/customer-server";

/** The signed-in shopper's WooCommerce order history. */
export async function GET() {
  const { status, data } = await callCustomerApi("/orders");
  return Response.json(data, { status });
}
