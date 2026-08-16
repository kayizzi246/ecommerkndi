import { NextResponse } from "next/server";
import { getFaviconUrl } from "@/lib/site-settings";

/**
 * The shop's favicon, served from this origin at a URL that never changes.
 *
 * ---- Why this route exists ----
 *
 * The icon uploaded in wp-admin was being linked directly, which meant every
 * page shipped:
 *
 *   <link rel="icon" href="https://shop.kandiug.com/wp-content/uploads/2026/08/
 *                          ChatGPT-Image-Aug-15-2026-09_37_53-AM.png">
 *
 * That works in a browser tab and is a poor thing to hand Google, for three
 * reasons — and the third is the one that actually matters.
 *
 * 1. It is a different host. The site is `kandiug.com`; the icon came from
 *    `shop.kandiug.com`, so the favicon lives behind a second DNS lookup, a
 *    second TLS handshake and a second robots.txt that nobody edits with the
 *    storefront in mind. Nothing about that is fatal, but none of it helps.
 *
 * 2. It was 1254x1254 and 304KB. Google asks for a square whose sides are a
 *    multiple of 48px, and browsers paint the thing at 16px.
 *
 * 3. THE URL CHANGES EVERY TIME THE SHOP RE-UPLOADS. That is the real problem.
 *    WordPress files the upload under the month it was uploaded and keeps the
 *    original filename, so replacing the logo produces a completely new URL.
 *    Google explicitly wants a favicon URL that stays put — it crawls the icon
 *    on its own schedule, separately from the page, and a URL that moves is one
 *    it has to rediscover and re-approve each time. A shop that tweaks its logo
 *    three times in a month can spend that month with no favicon in search
 *    results at all.
 *
 * `/brand-icon` is that stable URL. It is the same address forever, whatever is
 * uploaded behind it, so Google learns it once. The upload still works exactly
 * as before — this route just fetches whatever wp-admin currently points at and
 * hands it back under this origin's name.
 *
 * ---- What it does not do ----
 *
 * It does not resize. Doing that properly needs an image pipeline, and a
 * half-done job (upscaling a small logo, or squashing a wide one) would look
 * worse than the original. The size guidance therefore stays a matter for
 * whoever uploads: a square PNG, ideally 96x96 or 144x144, under about 100KB.
 * `getFaviconUrl` already refuses anything more lopsided than 1.6:1, because a
 * wide logo makes an illegible 16px tab icon.
 */

/** A day in the browser, a week at the CDN. */
const BROWSER_MAX_AGE = 60 * 60 * 24;
const CDN_MAX_AGE = 60 * 60 * 24 * 7;

export async function GET(request: Request) {
  /**
   * The bundled 512x512 icon, used whenever wp-admin has nothing usable.
   *
   * A redirect rather than a copy of the bytes: `/icon.png` is a static asset
   * already being served from this origin, and pulling it through this handler
   * as well would mean two things to keep in step. A 307 costs one extra
   * round trip on a request browsers make once and then cache for a day.
   */
  const fallback = () =>
    NextResponse.redirect(new URL("/icon.png", request.url), {
      status: 307,
      headers: { "Cache-Control": `public, max-age=${BROWSER_MAX_AGE}` },
    });

  let url: string | null = null;
  try {
    url = await getFaviconUrl();
  } catch {
    // wp-admin unreachable. The shop still has an icon; use it.
    return fallback();
  }

  if (!url) return fallback();

  try {
    // Revalidated hourly, so a newly uploaded logo appears within the hour
    // without this route re-fetching WordPress for every tab that opens.
    const upstream = await fetch(url, { next: { revalidate: 3600 } });
    if (!upstream.ok) return fallback();

    const type = upstream.headers.get("content-type") ?? "";
    // Guard against wp-admin handing back an HTML error page with a 200, which
    // a shared host will happily do. Serving that as an icon shows nothing at
    // all, where the bundled PNG shows the brand.
    if (!type.startsWith("image/")) return fallback();

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": type,
        // `immutable` is deliberately absent: the bytes behind this URL are
        // expected to change when the shop re-uploads, which is the entire
        // point of the URL being stable.
        "Cache-Control": `public, max-age=${BROWSER_MAX_AGE}, s-maxage=${CDN_MAX_AGE}, stale-while-revalidate=${CDN_MAX_AGE}`,
      },
    });
  } catch {
    return fallback();
  }
}
