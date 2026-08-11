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
 * A Content-Security-Policy is deliberately not set here. It would have to
 * allow Google Identity Services, Pesapal's checkout frame and the WordPress
 * media library, and a CSP written blind is a CSP that breaks payments — it
 * belongs in its own change, tested against a real checkout.
 */
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
];

const nextConfig: NextConfig = {
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
  },

  // Hides the framework version from responses. Minor, but a version number is
  // the first thing an automated scanner reads to pick which exploits to try.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
