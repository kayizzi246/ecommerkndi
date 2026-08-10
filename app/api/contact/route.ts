import { callKandiApi } from "@/lib/customer-server";

/**
 * Passes a contact-form message to WordPress, which emails it to the support
 * address. Posted server-side so the shared secret never reaches the browser —
 * an unauthenticated mail endpoint is a spam relay.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const { status, data } = await callKandiApi("/contact", {
    method: "POST",
    authenticated: false,
    body: {
      name: body.name,
      email: body.email,
      order: body.order,
      subject: body.subject,
      message: body.message,
    },
  });

  return Response.json(data, { status });
}
