import type { NextConfig } from "next";

/**
 * Response headers sent with every page.
 *
 * These are the cheap half of hardening — they cost nothing and close off whole
 * classes of attack that do not need a bug in our code to work:
 *
 *  • A shop that can be framed can be clickjacked: an attacker overlays an
 *    invisible copy of the checkout on their own page and harvests the taps.
 *  • MIME sniffing lets an uploaded "image" that is really a script be executed
 *    as one by browsers that guess at content types. Sellers upload files here.
 *  • The default referrer policy leaks the full URL — including an order id or
 *    a search a shopper would rather not share — to every third-party image and
 *    font the page touches.
 *
 * The Content-Security-Policy below is the other half, and it is the one that
 * turns a cross-site scripting bug from a total compromise into a nuisance:
 * without it, any injected script can read the page and post the contents —
 * including whatever is typed into the checkout — to an address of its
 * choosing. With it, the browser refuses to talk to anywhere not listed.
 */

/**
 * Every origin the shop legitimately loads from, and nothing else.
 *
 * Written from what the code actually uses rather than from a template — a CSP
 * copied from somewhere else is a CSP that breaks payments in production. The
 * three that matter:
 *
 *   • `accounts.google.com` — Google Identity Services, which is both a script
 *     and a frame (the sign-in prompt renders in an iframe).
 *   • `*.pesapal.com` — the checkout, which runs in an iframe over the shop.
 *     Both hosts are needed: `cybqa` is the sandbox, `pay` is live.
 *   • Images from anywhere over https, because product photography is served
 *     from whichever WordPress host the shop is configured against, and that
 *     list is editable in next.config without anyone remembering to also edit
 *     a header. Images are the one resource class where a wide allowance is
 *     defensible: a rogue image can leak that a page was viewed, not its
 *     contents.
 *
 * ## The `'unsafe-inline'` in `script-src`, stated plainly
 *
 * It is there, and it is the one real weakness in this policy. Removing it
 * requires a per-request nonce, and a nonce requires every page to be rendered
 * per request — which would turn 76 statically generated pages into 76 dynamic
 * ones and make the shop materially slower for every visitor. The shop also
 * emits inline JSON-LD on most pages, which is what earns the rich results.
 *
 * What the policy still buys with it in place is the part that matters most:
 * `script-src` has no wildcard, so an injected `<script src="//evil/x.js">`
 * will not load, and `connect-src` means an inline script that does run cannot
 * send anything it steals anywhere. The usual XSS payload is delivery plus
 * exfiltration, and both ends are closed.
 *
 * Worth revisiting if the shop ever moves to mostly-dynamic rendering.
 *
 * ## `'unsafe-eval'`, in development only
 *
 * React's development build calls `eval()` — it is how it reconstructs a
 * component stack that originated on the server so the error overlay can point
 * at the right line. With the policy below applied verbatim, `next dev` threw
 * "eval() is not supported in this environment" into the console on every page
 * load and the overlay lost its stack traces.
 *
 * React never calls `eval()` in a production build, so the allowance is gated
 * on NODE_ENV rather than added outright. `next build` and `next start` both
 * run with NODE_ENV=production, which means the deployed shop keeps the strict
 * policy and only the local dev server relaxes it — the shape of exemption
 * that cannot quietly reach production, because the flag that enables it is the
 * same one that decides which React build is being served.
 */
const DEV = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""} https://accounts.google.com`,
  // Tailwind and Next both emit inline style attributes; there is no nonce-free
  // way around this one, and injected CSS is a far smaller problem than
  // injected script.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  // next/font downloads Google Fonts at build time and serves them from our own
  // origin, so no external font host is needed.
  "font-src 'self' data:",
  // The `ws:` in development is Hot Module Replacement talking back to the dev
  // server. Browsers disagree about whether `'self'` covers a WebSocket on the
  // same origin, so it is named rather than assumed — and, like `'unsafe-eval'`
  // above, it is gated on NODE_ENV so production never carries it.
  `connect-src 'self'${DEV ? " ws: wss:" : ""} https://accounts.google.com`,
  "frame-src 'self' https://accounts.google.com https://*.pesapal.com",
  // Nothing here is a plugin, and `object-src 'none'` closes a whole family of
  // legacy injection tricks.
  "object-src 'none'",
  // Stops an injected `<base>` tag silently repointing every relative script
  // and link on the page at another host.
  "base-uri 'self'",
  // A form cannot be made to submit somewhere else — the direct defence against
  // an injected checkout that posts card details to an attacker.
  "form-action 'self'",
  // The clickjacking rule. `'self'` rather than `'none'` because the payment
  // callback page genuinely loads inside our own iframe. This supersedes
  // X-Frame-Options in any modern browser; that header stays for old ones.
  "frame-ancestors 'self'",
  // Any stray http:// subresource is fetched over https instead of being
  // blocked as mixed content.
  "upgrade-insecure-requests",
].join("; ");
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs a camera, a microphone or the payment API. Geolocation
  // is left alone: the delivery quote at checkout asks for it.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
  // Tells browsers to keep using HTTPS for this host for a year, so a shopper
  // on café wi-fi cannot be downgraded to plain HTTP on the next visit.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: CSP },
  // Isolates the shop's browsing context from anything it opens or that opens
  // it. `same-origin-allow-popups` rather than `same-origin` because Google
  // Sign-In runs in a popup and talks back to the opener — the stricter value
  // severs that channel and silently breaks sign-in.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Stops other sites embedding our responses as a subresource, which is the
  // mechanism behind the cross-origin leak attacks (XS-Leaks).
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Old scanners still flag its absence, and it costs nothing. Modern browsers
  // ignore it; `0` is correct because the filter it enables in older ones has
  // its own bugs and is worse than the CSP above.
  { key: "X-XSS-Protection", value: "0" },
];

const nextConfig: NextConfig = {
  // There is a stray package-lock.json in the user's home directory, and
  // Turbopack walks upwards looking for one to decide where the workspace
  // starts — so it picked the home directory and warned on every build. Naming
  // the root explicitly settles it, and means module resolution and file
  // watching are scoped to the shop rather than to everything above it.
  turbopack: { root: __dirname },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "acculifepharma.co.ug" },
      { protocol: "https", hostname: "www.acculifepharma.co.ug" },
      { protocol: "https", hostname: "7thculturetribe.com" },
      { protocol: "https", hostname: "www.7thculturetribe.com" },
      { protocol: "https", hostname: "shop.kandiug.com" },
      // Profile photos of shoppers who signed in with Google. Google serves
      // these from lh3…lh6.googleusercontent.com and picks the host per
      // account, so naming one of them would work until the day it did not.
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],

    /**
     * How long an optimized product photo stays cached before Next re-fetches
     * the original and re-encodes it.
     *
     * The default is 4 hours, which is tuned for images that change behind a
     * stable URL. Product photography here does the opposite: a seller uploads
     * a file, WordPress gives it its own URL, and that URL's contents never
     * change again — a replacement photo is a new upload with a new URL. So the
     * 4-hour expiry bought no freshness at all and cost a re-download from
     * WordPress plus a re-encode every time it lapsed, which is the "the images
     * are slow again" that shows up hours after a product was added.
     *
     * 31 days, the figure the docs give for exactly this case. The risk the
     * short default protects against — a changed image behind a cached URL —
     * cannot happen with WooCommerce media.
     */
    minimumCacheTTL: 2678400,

    // WebP only, deliberately. AVIF compresses about 20% smaller but takes
    // roughly 50% longer to encode, and that cost lands on the *first* request
    // for an image — which is precisely the moment this shop cares about, when
    // a seller has just added a product and is looking at it. Faster-once-warm
    // is the wrong trade for a catalogue that has new photos in it every day.
    formats: ["image/webp"],
  },

  // Hides the framework version from responses. Minor, but a version number is
  // the first thing an automated scanner reads to pick which exploits to try.
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },

      /**
       * The mobile app's public API is the one place that must be readable
       * from another origin.
       *
       * The blanket rule above sets `Cross-Origin-Resource-Policy: same-origin`,
       * which is right for the storefront and wrong here: these endpoints send
       * `Access-Control-Allow-Origin: *` precisely so the app can read them, so
       * the two headers were saying opposite things about the same response.
       *
       * In practice a CORS-mode `fetch` is not subject to CORP — the check only
       * applies to no-cors requests and to pages under COEP — so this was
       * unlikely to break the native app. But the FlutterFlow *web* build runs
       * on kandistyles.flutterflow.app and is cross-origin to this API, and a
       * header that contradicts the intent is a trap for whoever debugs it
       * next. Later rules win on duplicate keys, so this narrows CORP to
       * `cross-origin` for /api/app/* only.
       */
      {
        source: "/api/app/:path*",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }],
      },
    ];
  },
};

export default nextConfig;
