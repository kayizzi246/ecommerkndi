import { callCustomerApi } from "@/lib/customer-server";

/**
 * Asks WordPress to email a password reset link.
 *
 * Answers the same way whether or not the address has an account. That is not
 * politeness — a reply that differed would let anybody test addresses against
 * this endpoint and learn which ones shop here.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim();

  const { status, data } = await callCustomerApi("/password/forgot", {
    method: "POST",
    authenticated: false,
    body: { email },
  });

  // 429 is the one case worth passing through honestly: somebody who has asked
  // three times in ten minutes needs to be told to wait, not left believing a
  // fourth email is coming.
  if (status === 429) {
    const message =
      (data as { message?: string })?.message ??
      "Too many attempts. Please wait a few minutes and try again.";
    return Response.json({ message }, { status: 429 });
  }

  return Response.json({
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  });
}
