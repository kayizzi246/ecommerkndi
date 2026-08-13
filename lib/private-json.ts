/**
 * A JSON response that nothing between here and the browser may store.
 *
 * Session-shaped responses — who is signed in, their orders, their earnings —
 * are the one class of reply where a cache hit is a data leak rather than a
 * performance win. The URL is identical for every seller (`/api/seller/me`),
 * so a shared cache has no way to tell two sellers apart: whoever asks first
 * fills the cache and everyone after them is handed that person's account.
 *
 * This shop had exactly that. A seller signed in with their own address and
 * was shown a different store, and suspending that other account changed
 * nothing — because the reply was never reaching WordPress to be refused.
 *
 * Three headers, because they are read by different things:
 *
 *   • `private`      — shared caches (Cloudflare, any proxy) must not store it,
 *                      even under a "cache everything" rule.
 *   • `no-store`     — nobody stores it at all, browser included.
 *   • `Vary: Cookie` — for any cache that ignores the above, the session cookie
 *                      is at least part of the key, so two sellers cannot
 *                      collide on one entry.
 *
 * Correct headers are the fix; the `dynamic` export on each route only stops
 * Next itself from prerendering, which was never the layer at fault.
 */
export function privateJson(data: unknown, init?: { status?: number }): Response {
  return Response.json(data, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
    },
  });
}
