import { completeCustomerSession } from "@/lib/customer-auth";

/**
 * Sets a new password from the key in a reset email, and signs the shopper in.
 *
 * The key and login come straight from the emailed link and are not inspected
 * here — only WordPress can say whether a key is genuine, unexpired and unused,
 * and any check invented on this side would either duplicate that or contradict
 * it.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    key?: string;
    login?: string;
    password?: string;
  };

  const key = body.key ?? "";
  const login = body.login ?? "";
  const password = body.password ?? "";

  if (!key || !login) {
    return Response.json(
      { message: "That reset link is not valid. Please request a new one." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return Response.json(
      { message: "Use at least 8 characters for your password." },
      { status: 400 }
    );
  }

  return completeCustomerSession("/password/reset", { key, login, password });
}
