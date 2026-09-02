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
  // `challenges.cloudflare.com` is Turnstile, the bot check on checkout. Like
  // Google Sign-In it is both a script and a frame, and it talks back to
  // Cloudflare to verify — so it is named in three directives below, not one.
  // Listed whether or not the shop has set its keys: a CSP entry for a host
  // that is never contacted costs nothing, and a missing one is a silent
  // failure at the worst possible moment.
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""} https://accounts.google.com https://challenges.cloudflare.com`,
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
  `connect-src 'self'${DEV ? " ws: wss:" : ""} https://accounts.google.com https://challenges.cloudflare.com`,
  "frame-src 'self' https://accounts.google.com https://*.pesapal.com https://challenges.cloudflare.com",
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

  /**
   * ---- Do not stampede WordPress during a build ----
   *
   * Prerendering fans out across workers, and each product page makes several
   * calls to shop.kandiug.com. Measured from here that host answers a single
   * product in about 1.4 seconds — fine — but it is shared hosting, and eight
   * workers asking at once queue behind each other until pages start blowing
   * through Next's 60-second per-page ceiling. The build log fills with
   *
   *     Failed to build /products/[id]/page: ... because it took more than 60
   *     seconds. Retrying again shortly.
   *
   * and every one of those is a page rendered two or three times over. The
   * builds still passed; they were just paying for the same page repeatedly and
   * taking several minutes to do it.
   *
   * Three at a time is slower in theory and faster in practice against a host
   * that can only serve so many PHP requests at once. The retry count is raised
   * from the default 1 so a genuine blip costs a retry rather than the build.
   *
   * If the shop moves to a host that can take the load, raise this — it is a
   * ceiling on concurrency, not a target.
   */
  experimental: {
    staticGenerationMaxConcurrency: 3,
    staticGenerationRetryCount: 3,
  },

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

    /**
     * The encoder qualities this shop is allowed to ask for.
     *
     * ---- Why this is a list and not a number ----
     *
     * Next 16 changed the default for `images.qualities` from "anything" to
     * `[75]`, and the optimizer ENFORCES it: a request for a quality outside
     * the list is answered with `"q" parameter (quality) of N is not allowed`,
     * not quietly rounded. The upgrade note says out-of-range values are
     * "coerced to the closest value", and that describes the client half only
     * — the server half rejects. Getting this wrong does not degrade an image,
     * it fails to serve one.
     *
     * So 75 stays in the list even though nothing should request it any more.
     * It is the default when no `quality` prop is passed, and there are 39
     * `<Image>` call sites in this shop: the day somebody adds the fortieth
     * without the prop, the image should render at the old quality rather than
     * 404.
     *
     * ---- Why 90 ----
     *
     * 75 is a sensible default for a general-purpose site and the wrong one
     * for this shop. Every photograph here is a garment or a shoe that somebody
     * is deciding whether to buy from the picture alone, and WebP at 75 puts
     * visible mush into exactly the places that decision turns on: the weave of
     * a fabric, the stitching on a seam, the transition from a white product to
     * a white background. The catalogue is also mostly studio shots on white,
     * which is the hardest case for a lossy encoder — large flat areas make
     * banding and ringing obvious rather than hiding them.
     *
     * 90 rather than 100 because the curve flattens hard above it: 90 to 100
     * roughly doubles the file for a difference that needs a loupe. 75 to 90 is
     * about 40% more bytes for a difference that is visible at arm's length on
     * a phone, which is the trade worth making on a shop where the photograph
     * IS the product page.
     *
     * The bandwidth this costs is real and it is bought back elsewhere: every
     * `sizes` string in the shop is matched to its grid (see `GRID_SIZES` in
     * `ProductCard`), so a tile fetches a tile-sized file rather than a
     * screen-sized one. Quality went up; the number of pixels did not.
     */
    qualities: [75, 90],

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

  /**
   * Every address a favicon crawler tries by habit serves the same file.
   *
   * ---- The bug this closes ----
   *
   * The head declares one icon — `/icon.png`, the mark that ships in
   * `public/` — and that part is settled. But `/favicon.ico` is not a
   * declaration, it is a *convention*: browsers and Google's favicon crawler
   * request it whether or not the page says anything. Until these rules
   * existed it answered with a different picture, so there were two Kandi
   * marks live at two URLs with nothing deciding which one a crawler kept.
   *
   * The file that used to sit at `public/favicon.ico` was a real 16/32/48
   * multi-frame icon of an older orange "K", generated once and then left
   * behind while the shop's logo moved on. A shop owner who replaced their
   * logo saw the tab update and the search result stay — the complaint that
   * has now been chased through several fixes in `app/layout.tsx`. It has been
   * deleted, because anything in `public/` is served *before* a rewrite is
   * consulted and would have made this rule silently do nothing.
   *
   * `/brand-icon` is here for the opposite reason: it is a URL that used to
   * work. It was a route handler proxying the wp-admin upload, and it was what
   * the head declared for long enough that Google has it on file. The route is
   * gone — see the icon note in `app/layout.tsx` for why the icon no longer
   * depends on WordPress — so this keeps the learned address answering rather
   * than 404ing, which is the one thing that would cost search results.
   *
   * Rewrites rather than redirects, so the icon arrives in one round trip.
   * The content type does not matter: Google has accepted PNG at
   * `/favicon.ico` since favicons stopped being required to be ICO files.
   */
  async rewrites() {
    return [
      { source: "/favicon.ico", destination: "/icon.png" },
      { source: "/brand-icon", destination: "/icon.png" },
    ];
  },
};

export default nextConfig;
