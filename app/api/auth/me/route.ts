import { callCustomerApi } from "@/lib/customer-server";

export async function GET() {
  const { status, data } = await callCustomerApi("/me");
  return Response.json(data, { status });
}
