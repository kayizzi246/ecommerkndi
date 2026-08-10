import { callCustomerApi } from "@/lib/customer-server";

/** Saves the shopper's delivery preferences to their WordPress profile. */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    departments?: string[];
    size?: string;
    city?: string;
  };

  const { status, data } = await callCustomerApi("/preferences", {
    method: "PUT",
    body,
  });

  return Response.json(data, { status });
}
