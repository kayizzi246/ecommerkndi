import { revalidatePath, revalidateTag } from "next/cache";
import { isOwnerAuthenticated, PRODUCTS_TAG } from "@/lib/owner-server";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/**
 * Cache purge, called by WordPress whenever a product changes.
 *
 * Product reads are cached for a minute so the shop stays fast. That window is
 * why a product deleted in wp-admin kept appearing on the storefront: nothing
 * told Next.js the catalogue had changed, so it went on serving what it had
 * until the minute ran out — and a prerendered page could hold it longer still.
 *
 * The Kandi plugins now ping this route on every product save, trash, untrash
 * and delete. It is authenticated with the same shared secret as everything
 * else, because an open purge endpoint is a way to make a site rebuild itself
 * on demand until it falls over.
 */

function purge() {
  revalidateTag(PRODUCTS_TAG, { expire: 0 });
  // The homepage and listing pages are prerendered, so dropping the fetch cache
  // alone would still serve the old HTML until the page itself expired.
  revalidatePath("/", "layout");
}

/** Reads the secret from the header, or from `?secret=` for wp_remote_get. */
function authorised(request: Request): boolean {
  const expected = process.env.KANDI_API_SECRET ?? "";
  if (!expected) return false;

  const sent =
    request.headers.get("x-kandi-secret") ??
    new URL(request.url).searchParams.get("secret") ??
    "";

  // Same length check first: `!==` on secrets of different lengths leaks
  // nothing useful here, but keeping the comparison uniform costs nothing.
  return sent.length === expected.length && sent === expected;
}

export async function POST(request: Request) {
  // Throttled before either credential is examined. Purging is the single most
  // expensive thing an outsider can ask this app to do — it drops the whole
  // render cache and sends every subsequent visitor through to WordPress — so
  // the ceiling has to apply to unauthenticated attempts too, not only to the
  // ones that get past the check.
  const limit = rateLimit("revalidate", clientIp(request), LIMITS.revalidate);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  // Two ways in: the shared secret, which is how WordPress calls this, and a
  // signed-in owner, which is how the "Refresh catalogue" button on /admin
  // calls it. The button matters because the WordPress ping only works once
  // the Storefront URL is filled in — the owner should never be stuck looking
  // at a stale shop with no way to clear it by hand.
  //
  // The owner branch verifies the passcode with WordPress rather than merely
  // noting that a cookie was sent. It used to do the latter, which meant this
  // endpoint was open to anyone willing to type a cookie header: `httpOnly`
  // prevents the page's own scripts from reading the value, but nothing stops a
  // client inventing one.
  if (!authorised(request) && !(await isOwnerAuthenticated())) {
    return Response.json({ message: "Invalid API secret." }, { status: 403 });
  }

  purge();
  return Response.json({ revalidated: true, now: Date.now() });
}

/** GET is accepted too, so a browser or wp_remote_get can trigger a purge. */
export async function GET(request: Request) {
  return POST(request);
}
