import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";

/**
 * Records that a product page was looked at.
 *
 * ## Why this route exists at all
 *
 * Sellers can see what they sold and nothing about what was *considered*. Those
 * are different questions, and the second one is the one that tells a seller
 * what to fix: a listing with three hundred views and no orders has a price or
 * a photograph problem, and a listing with no views has a title or a category
 * problem. Without views, both look identical on the dashboard — a zero in the
 * units column — and the seller has no way to tell which mistake they made.
 *
 * ## Why the browser does not talk to WordPress directly
 *
 * The plugin authenticates storefront traffic with `X-Kandi-Secret`. A shared
 * secret in a client-side fetch is not a secret, and an unauthenticated public
 * counter is a number anybody can type into — which would make the figure worse
 * than not having it, because a seller would believe it.
 *
 * So the count is written server-side, from here, and this route is what a
 * browser is allowed to reach.
 *
 * ## What is deliberately NOT counted
 *
 *   • Crawlers. Googlebot renders JavaScript, so a naive counter measures
 *     Google's interest rather than shoppers'. Known bot agents are dropped
 *     here rather than filtered later, because a number that has to be
 *     explained is a number nobody trusts.
 *   • Repeat views inside one session. The client sends at most one ping per
 *     product per tab (see `ProductViewPing`); this end enforces a ceiling too,
 *     since the client half is trivially bypassed.
 *
 * ## What this route promises the caller
 *
 * Nothing. It always answers 202 with an empty body, whatever happened
 * downstream — including when the WordPress side has no such endpoint yet.
 * Analytics must never be able to break a product page, and the page has no use
 * for the answer.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Matches the crawlers that actually execute JavaScript, plus the obvious ones. */
const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|lighthouse|headless|pingdom|uptime|monitor/i;

function accepted(): Response {
  // 202: taken, not necessarily acted upon — which is exactly true here.
  return new Response(null, { status: 202 });
}

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!userAgent || BOT_PATTERN.test(userAgent)) return accepted();

  /**
   * A ceiling per address, not per product.
   *
   * One shopper genuinely browsing hits this a few dozen times an hour; the
   * `api` bucket allows 120 a minute, which no human reaches and a script does
   * immediately. Rate limiting is the only thing standing between this endpoint
   * and a seller inflating their own listing, so it is the one place here that
   * refuses rather than shrugs.
   */
  const limit = rateLimit("product-view", clientIp(request), LIMITS.api);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  let productId = 0;
  try {
    const body = (await request.json()) as { productId?: unknown };
    productId = Number(body.productId) || 0;
  } catch {
    return accepted();
  }

  if (!Number.isInteger(productId) || productId <= 0) return accepted();

  const base = process.env.WP_API_URL;
  if (!base) return accepted();

  try {
    await fetch(`${base.replace(/\/$/, "")}/product-views`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
      },
      body: JSON.stringify({ product_id: productId }),
      cache: "no-store",
      // The shopper is already reading the page; nothing waits on this. Five
      // seconds is long enough for a healthy write and short enough that a sick
      // WordPress does not tie up a serverless invocation per view.
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    // Logged, never surfaced. A shop whose product pages fail because the
    // analytics write timed out has traded something valuable for something
    // that is not.
    console.error("[kandi-views] could not record view:", error);
  }

  return accepted();
}
