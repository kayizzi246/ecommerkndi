import { callOwnerApi, setOwnerCookie } from "@/lib/owner-server";

/**
 * Owner sign-in.
 *
 * The passcode is not checked here — it is sent straight to WordPress, which
 * holds the real value and compares it in constant time. Only once WordPress
 * has accepted it does it go into the httpOnly cookie, so a wrong passcode
 * never leaves a half-signed-in state behind.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { passcode?: unknown };
  const passcode = typeof body.passcode === "string" ? body.passcode.trim() : "";

  if (!passcode) {
    return Response.json({ message: "Enter your owner passcode." }, { status: 400 });
  }

  const { status, data } = await callOwnerApi("/me", { passcode });

  if (status !== 200) {
    return Response.json(data, { status });
  }

  await setOwnerCookie(passcode);
  return Response.json(data, { status: 200 });
}
