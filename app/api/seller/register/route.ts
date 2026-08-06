import { callSellerApi } from "@/lib/seller-server";

const REQUIRED = ["store_name", "owner_name", "email", "phone", "password"] as const;

/** Public seller sign-up. New accounts land in WordPress as `pending` for review. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const missing = REQUIRED.filter((field) => !body[field]);
  if (missing.length > 0) {
    return Response.json(
      { message: `Missing required field(s): ${missing.join(", ")}.` },
      { status: 400 }
    );
  }

  const { status, data } = await callSellerApi("/register", {
    method: "POST",
    authenticated: false,
    body,
  });

  return Response.json(data, { status });
}
