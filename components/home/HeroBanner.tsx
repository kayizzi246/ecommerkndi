import Link from "next/link";
import { formatPrice } from "@/lib/currency";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * The homepage hero — the full-width block that opens the page.
 *
 * TWO modes, decided in wp-admin rather than here:
 *
 *   1. UPLOADED. "Kandi Storefront → Hero image" holds artwork. It is shown
 *      full width, linked, uncropped, and nothing is drawn over it — campaign
 *      artwork arrives with its own typography baked into the pixels, and a
 *      headline on top of it is two headlines.
 *   2. BUILT-IN. No upload, which is the shipped state. The designed panel
 *      below runs instead, built from the same four settings fields, so a shop
 *      that never opens the settings screen still has a hero rather than a hole.
 */

/**
 * The widths the hero is encoded at, and the only ones it may ask for.
 *
 * Every value must appear in `images.deviceSizes` — Next's optimiser answers
 * 400 to a width it was not configured for, and a 400 on the LCP element is a
 * blank band at the top of the homepage. These four are all framework defaults.
 */
const HERO_WIDTHS = [640, 828, 1080, 1920] as const;

/**
 * A banner URL routed through Next's image optimiser.
 *
 * The uploaded hero is whatever file the shop dropped into wp-admin, served
 * from the WordPress host — on this shop a 533KB PNG that host answered in
 * 5.8 seconds, as the LCP element of the homepage. `/_next/image` resizes it,
 * re-encodes to WebP and serves it from the deployment's CDN instead.
 *
 * Built by hand rather than with `<Image>` because `<Image>` requires `width`
 * and `height` and the rendered box then follows THOSE numbers rather than the
 * file's own proportions. The hero is a file of unknown shape uploaded by a
 * shopkeeper; declaring a ratio we do not know is what sliced the bottom off
 * the artwork the last two times. A plain `<img>` with `h-auto` lets the
 * browser read the intrinsic size and lay it out uncropped.
 *
 * `q=90` must stay inside `images.qualities` in next.config.ts. Nothing
 * type-checks this URL, and a quality outside that set is a 400 from the
 * optimiser and a hero that does not render.
 */
function optimised(src: string, width: number): string {
  if (!/^https?:\/\//i.test(src)) return src;

  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=90`;
}

function heroSrcSet(src: string): string | undefined {
  if (!/^https?:\/\//i.test(src)) return undefined;

  return HERO_WIDTHS.map((width) => `${optimised(src, width)} ${width}w`).join(", ");
}

export default function HeroBanner({ settings }: { settings: SiteSettings }) {
  const {
    eyebrow,
    headline,
    cta_label,
    cta_url,
    image_url: wide,
    image_mobile_url: narrow,
    image_href,
    image_alt,
  } = settings.banner;

  /* EITHER field turns the uploaded hero on. Uploading only the phone crop is
     the reasonable thing to do first — the admin screen presses for one — and
     testing `wide` alone silently ignored it. Both optional, either alone is a
     complete answer, neither means the built-in panel. */
  const mobileSrc = narrow || wide;
  const desktopSrc = wide || narrow;

  return (
    <section aria-label="Featured offer" className="phone-gutter">
      {mobileSrc && desktopSrc ? (
        <>
          {/* The LCP preload. `media` is what keeps this from undoing the
              `<picture>` below — one banner is preloaded and it is the one that
              will be painted. `imageSrcSet` and `imageSizes` must match the tag
              they preload exactly, or the browser picks a different candidate
              and this becomes a second download rather than a head start.
              Change these and the `<picture>` together. */}
          <link
            rel="preload"
            as="image"
            media="(max-width: 767px)"
            href={optimised(mobileSrc, 1080)}
            imageSrcSet={heroSrcSet(mobileSrc)}
            imageSizes="100vw"
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            media="(min-width: 768px)"
            href={optimised(desktopSrc, 1920)}
            imageSrcSet={heroSrcSet(desktopSrc)}
            imageSizes="100vw"
            fetchPriority="high"
          />

          <Link
            href={image_href || cta_url || "/sale"}
            className="block overflow-hidden rounded-2xl bg-shop-hairline"
          >
            {/* `<picture>` rather than one srcset: these are two DIFFERENT
                pictures — a wide desktop crop and a tall phone crop, usually
                with different wording — which is art direction, and the browser
                fetches exactly one of them. Two `<img>`s hidden per breakpoint
                does NOT stop the second fetch; `display:none` still downloads. */}
            <picture>
              <source media="(min-width: 768px)" srcSet={heroSrcSet(desktopSrc)} sizes="100vw" />
              <img
                src={optimised(mobileSrc, 1080)}
                srcSet={heroSrcSet(mobileSrc)}
                sizes="100vw"
                alt={image_alt || "Featured offer"}
                loading="eager"
                fetchPriority="high"
                className="h-auto w-full"
              />
            </picture>
          </Link>
        </>
      ) : (
        /* ---- The built-in hero ----

           Not wrapped in one big `<a>`, deliberately: it carries two calls to
           action, and an anchor inside an anchor is invalid HTML that browsers
           repair by closing the outer one early — which silently detaches half
           the panel from the link it looks like it belongs to.

           Brand orange running into the shop's deal red — the two hues the store
           already owns, and nothing else. White type on it: the headline is
           display size, where 3:1 is the bar and the gradient clears it at its
           lightest stop; the smaller lines sit on the darker half. */
        <div className="relative isolate flex min-h-[300px] flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#f2560a] via-[#e3401a] to-[#c62828] px-5 py-10 text-white md:min-h-[400px] md:px-12 md:py-14 lg:min-h-[440px]">
          {/* Soft discs, bottom right. The panel is a flat gradient otherwise,
              and a flat gradient at this size reads as an image that failed to
              load; these are what say it was drawn on purpose. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-16 -z-10 h-72 w-72 rounded-full bg-white/10 md:h-[26rem] md:w-[26rem]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 bottom-10 -z-10 h-32 w-32 rounded-full bg-white/10 md:h-48 md:w-48"
          />

          <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/30 md:text-[12px]">
            {eyebrow}
          </span>

          {/* `max-w-[16ch]` is what keeps a long headline breaking into two or
              three big lines rather than one thin one running the width of a
              desktop — display type is read in a block, not across a page. */}
          <h2 className="hero-display mt-3 max-w-[16ch] text-[31px] leading-[1.05] text-white md:mt-4 md:text-[51px] lg:text-[57px]">
            {headline}
          </h2>

          <p className="mt-3 max-w-[42ch] text-[12px] leading-relaxed text-white/85 md:mt-4 md:text-[14px]">
            Free delivery over{" "}
            <span className="font-semibold text-white">
              {formatPrice(settings.commerce.free_delivery_from)}
            </span>
            , pay cash when it arrives, and {settings.commerce.returns_days} days to send it
            back.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5 md:mt-7 md:gap-3">
            <Link
              href={cta_url || "/sale"}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-[13px] font-bold text-shop-primary-ink transition-colors hover:bg-shop-primary-soft md:px-8 md:py-3.5 md:text-[14px]"
            >
              {cta_label}
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center rounded-lg px-6 py-3 text-[13px] font-bold text-white ring-1 ring-white/50 transition-colors hover:bg-white/10 md:px-8 md:py-3.5 md:text-[14px]"
            >
              Browse categories
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
