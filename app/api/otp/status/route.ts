import { cookies } from "next/headers";
import { privateJson } from "@/lib/private-json";
import { readVerified, VERIFIED_COOKIE } from "@/lib/otp";

/**
 * Whether this browser has ever proved a phone number or an email address.
 *
 * The gate in front of checkout is a client component and the marker it needs
 * to read is `httpOnly` — deliberately, because a cookie a page script can
 * write is a cookie a shopper can write themselves. So the client asks.
 *
 * `privateJson` matters more here than it looks: the URL is the same for every
 * visitor, and a shared cache that stored one shopper's answer would hand the
 * next one somebody else's verified number. The same failure this shop has
 * already had once on `/api/seller/me`.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const verified = await readVerified((await cookies()).get(VERIFIED_COOKIE)?.value);

  return privateJson({
    verified: verified !== null,
    channel: verified?.channel ?? null,
    /* The full contact, not the mask. It is this browser's own value — it was
       typed on this device and proved from it — and the checkout form uses it
       to pre-fill the phone field. A mask would make it useless for that and
       would protect nothing the cookie is not already protecting. */
    contact: verified?.value ?? null,
  });
}
