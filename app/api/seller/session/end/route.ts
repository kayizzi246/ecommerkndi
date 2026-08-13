import { clearSellerCookie } from "@/lib/seller-server";
import { privateJson } from "@/lib/private-json";

export const dynamic = "force-dynamic";

/**
 * Drops the seller cookie in this browser, and nothing else.
 *
 * Deliberately not /logout. That route also asks WordPress to destroy the
 * token, which is the right thing when a seller presses "Sign out" — they are
 * finished, and the token should stop working everywhere. This is for the other
 * case: a browser that is *carrying* a session it should not be acting on, at
 * the moment somebody opens the sign-in or sign-up screen.
 *
 * The distinction matters because the token may not belong to the person
 * sitting there. Destroying it server-side would sign out the seller who left
 * it behind — possibly on their own machine, mid-session, in another tab —
 * simply because someone opened "Open a seller account". Forgetting it here is
 * enough: this browser stops being them, their session survives, and the new
 * arrival starts as nobody.
 *
 * Always 200. There is nothing to fail: absent cookie, expired cookie and
 * cleared cookie are the same outcome, which is that the caller is now nobody.
 */
export async function POST() {
  await clearSellerCookie();
  return privateJson({ ok: true });
}
