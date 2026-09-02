import { NextResponse } from "next/server";
import { suggestPlaces } from "@/lib/geocode";
import { clientIp, enforceRateLimit, MONEY_LIMITS } from "@/lib/rate-limit";

/**
 * GET /api/delivery/suggest?q=ntinda
 *
 * The places matching what the shopper has typed, for the checkout's location
 * autocomplete.
 *
 * ---- Why this is rate limited when it only reads ----
 *
 * For the same reason `/api/delivery/quote` is: with a Google key configured,
 * every call is a billed Geocoding request. An autocomplete is the worst shape
 * of endpoint to leave open, because it is *designed* to be called on every
 * keystroke — so the browser debounces, and this refuses a caller that ignores
 * the debounce. Without a key it hits Nominatim, whose usage policy is a
 * request a second and whose enforcement is a ban.
 *
 * The limit is deliberately looser than the quote's: a shopper legitimately
 * types several searches while finding their area, and getting locked out of
 * the address field is a lost order.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Nobody types their suburb in more than this; longer is a script. */
const MAX_QUERY = 120;

export async function GET(request: Request) {
  const throttled = await enforceRateLimit("delivery-suggest", clientIp(request), {
    ...MONEY_LIMITS.deliveryQuote,
    limit: MONEY_LIMITS.deliveryQuote.limit * 3,
  });

  if (throttled) return throttled;

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();

  // Under three characters every provider returns the whole country, which is
  // five suggestions of nothing and a billed request to produce them.
  if (query.length < 3 || query.length > MAX_QUERY) {
    return NextResponse.json({ places: [] });
  }

  const places = await suggestPlaces(query);

  return NextResponse.json(
    { places },
    {
      // Two shoppers typing "Ntinda" a minute apart should not be two billed
      // lookups. Private is wrong here — this is not personal, it is a place
      // name — so the shared CDN cache is exactly the right place for it.
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    }
  );
}
