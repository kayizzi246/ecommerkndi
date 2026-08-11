import { completeCustomerSession } from "@/lib/customer-auth";

/** Creates a shopper account from an email address and a password. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
  };

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();

  if (!email) {
    return Response.json({ message: "Enter your email address." }, { status: 400 });
  }

  // Checked here as well as in WordPress. The same rule enforced in both
  // places means the shopper is told immediately, rather than after a round
  // trip, while the server still refuses anything that arrives another way.
  if (password.length < 8) {
    return Response.json(
      { message: "Use at least 8 characters for your password." },
      { status: 400 }
    );
  }

  return completeCustomerSession("/register", { email, password, name });
}
