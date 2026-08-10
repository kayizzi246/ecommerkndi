import { clearOwnerCookie } from "@/lib/owner-server";

export async function POST() {
  await clearOwnerCookie();
  return Response.json({ ok: true });
}
