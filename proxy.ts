import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge filtering — the cheapest layer of defence, run before anything renders.
 *
 * Named `proxy.ts` rather than `middleware.ts`: Next.js 16 renamed the
 * convention, and a file called `middleware.ts` is now simply ignored. It runs
 * on the Node.js runtime (the `runtime` segment option is not available here
 * and throws if set).
 *
 * ## What belongs here, and what does not
 *
 * This file turns away traffic that is obviously not a shopper. It is not the
 * authorisation layer — the docs are explicit that proxy should not be relied
 * on for that, and every route that needs a session still checks one for
 * itself. Nothing below decides who may see what; it only decides what is not
 * worth rendering a page for.
 *
 * It also has to be *fast*. Every request the shop serves passes through here,
 * so this is string comparison and nothing else: no network calls, no cookie
 * verification, no catalogue reads.
 */

/**
 * Paths probed by automated vulnerability scanners, every one of which is a
 * scan and none of which this shop has.
 *
 * A storefront on a WordPress backend is scanned constantly for exactly these:
 * an exposed `.env` gives up the WooCommerce keys and the Pesapal credentials,
 * `.git/config` gives up the whole source history, and the wp-* paths are worth
 * trying because the *backend* is WordPress even though this front end is not.
 *
 * Answering these with a 404 costs a rendered not-found page each time. They
 * are refused here instead, before routing, which is both faster and quieter —
 * a scanner reading 404s learns the shape of the site, and one reading a flat
 * refusal learns nothing.
 */
const BLOCKED_PATH_PATTERNS = [
  // Secrets and source control.
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/\.aws/i,
  /^\/\.ssh/i,
  /^\/\.vscode/i,
  /^\/\.idea/i,
  // WordPress probes. The backend is WordPress, but it is not served from this
  // origin — anything asking this host for it is fishing.
  /^\/wp-admin/i,
  /^\/wp-login/i,
  /^\/wp-content/i,
  /^\/wp-includes/i,
  /^\/wp-json/i,
  /^\/xmlrpc\.php/i,
  /^\/wordpress/i,
  // Other stacks' admin panels and dumps.
  /^\/phpmyadmin/i,
  /^\/pma/i,
  /^\/adminer/i,
  /^\/cgi-bin/i,
  /^\/vendor\//i,
  /^\/config\.(php|json|yml|yaml)$/i,
  /^\/backup/i,
  /^\/dump\.sql$/i,
  /\.(php|asp|aspx|jsp|cgi|sql|bak|old|swp)$/i,
];

/**
 * Scanners and scrapers identified by their own user agent.
 *
 * Deliberately short, and deliberately *not* a general bot blocklist. Two
 * reasons to keep it narrow:
 *
 *  • Blocking a search crawler by accident is far more damaging to this shop
 *    than any scraper — the whole point of the SEO work is to be crawled.
 *    Googlebot, Bingbot and the social preview fetchers must always pass.
 *  • User agents are self-reported, so a determined attacker simply changes
 *    theirs. This stops the lazy majority; the rate limiter is what handles
 *    anyone who bothers to lie.
 *
 * These are attack tools rather than crawlers, so there is no legitimate
 * traffic to lose by refusing them.
 */
const BLOCKED_AGENTS = [
  "sqlmap",
  "nikto",
  "nmap",
  "masscan",
  "zgrab",
  "nessus",
  "acunetix",
  "wpscan",
  "dirbuster",
  "gobuster",
  "havij",
  "arachni",
  "metasploit",
  "xmrig",
];

/**
 * Paths that must never be indexed, whatever else happens.
 *
 * robots.txt already asks crawlers to stay out of these, but robots.txt is a
 * request and `X-Robots-Tag` is an instruction. The difference matters for the
 * account and seller areas: a page that leaks into an index is not just an SEO
 * problem when it has somebody's order history on it.
 */
const NOINDEX_PREFIXES = [
  "/account",
  "/seller",
  "/admin",
  "/cart",
  "/checkout",
  "/order-received",
  "/payment",
  "/track-order",
  "/api",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    // 404 rather than 403: a refusal confirms there is something to refuse,
    // while "no such thing here" ends the conversation. Nothing is logged and
    // no body is sent, so a scan costs the attacker a round trip and gains
    // them one bit of information.
    return new NextResponse(null, { status: 404 });
  }

  const agent = request.headers.get("user-agent")?.toLowerCase() ?? "";

  // An entirely absent user agent is not blocked. Plenty of legitimate things
  // omit it — health checks, some mobile webviews, curl in a support call —
  // and the cost of being wrong is a shopper who cannot reach the shop at all.
  if (agent && BLOCKED_AGENTS.some((tool) => agent.includes(tool))) {
    return new NextResponse(null, { status: 404 });
  }

  const response = NextResponse.next();

  if (NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

/**
 * Without a matcher this runs on every request including `_next/static`, the
 * image optimiser and everything in `public/` — which would put a regex sweep
 * in front of every CSS file, JS chunk and product photograph the shop serves.
 *
 * The negative lookahead excludes exactly those. `sitemap.xml`, `robots.txt`
 * and the icons are excluded too: they are hot paths for crawlers, and none of
 * the checks above can ever match them.
 *
 * `/api` is deliberately *not* excluded — the blocked-path and blocked-agent
 * checks are worth running in front of the API more than anywhere else.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|apple-icon\\.png|sitemap\\.xml|robots\\.txt).*)",
  ],
};
