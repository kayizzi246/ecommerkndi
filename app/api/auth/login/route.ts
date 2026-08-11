import { completeCustomerSession } from "@/lib/customer-auth";

/** Signs a shopper in with an email address and a password. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return Response.json({ message: "Enter your email and your password." }, { status: 400 });
  }

  // The password is not validated here beyond being present. Length rules
  // belong on the way in, not on the way back: an old account with a short
  // password must still be able to sign in, and telling somebody their
  // existing password is "too short" at the login screen is a dead end.
  return completeCustomerSession("/login", { email, password });
}
