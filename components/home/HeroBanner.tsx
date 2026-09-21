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

  /* The offers the shop has actually written, shown under the hero where an
     offer belongs — beside the thing it applies to. Empty is the shipped state
     and draws nothing. */
  const offers = settings.promotions
    .filter((promotion) => promotion.headline)
    .slice(0, 3);

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

           Light rather than a saturated slab. A full-width block of brand
           orange above the fold is the largest and heaviest object on the page,
           which is the thing the masthead note in `Header` records being taken
           back out. The brand is spent on the eyebrow, the disc and the button. */
        <div className="relative isolate flex min-h-[300px] flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff6ee] via-[#ffeadb] to-[#ffdcc4] px-5 py-10 ring-1 ring-shop-primary/15 md:min-h-[400px] md:px-12 md:py-14 lg:min-h-[440px]">
          {/* Soft discs, bottom right. The panel is a flat gradient otherwise,
              and a flat gradient at this size reads as an image that failed to
              load; these are what say it was drawn on purpose. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-16 -z-10 h-72 w-72 rounded-full bg-white/60 md:h-[26rem] md:w-[26rem]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 bottom-10 -z-10 h-32 w-32 rounded-full bg-shop-primary/10 md:h-48 md:w-48"
          />

          <span className="w-fit rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-shop-primary-ink ring-1 ring-shop-primary/20 md:text-[12px]">
            {eyebrow}
          </span>

          {/* `max-w-[16ch]` is what keeps a long headline breaking into two or
              three big lines rather than one thin one running the width of a
              desktop — display type is read in a block, not across a page. */}
          <h2 className="hero-display mt-3 max-w-[16ch] text-[32px] leading-[1.05] text-shop-ink md:mt-4 md:text-[52px] lg:text-[58px]">
            {headline}
          </h2>

          <p className="mt-3 max-w-[42ch] text-[13px] leading-relaxed text-shop-body md:mt-4 md:text-[15px]">
            Free delivery over{" "}
            <span className="font-semibold text-shop-ink">
              {formatPrice(settings.commerce.free_delivery_from)}
            </span>
            , pay cash when it arrives, and {settings.commerce.returns_days} days to send it
            back.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5 md:mt-7 md:gap-3">
            <Link
              href={cta_url || "/sale"}
              className="btn-shop px-6 py-3 text-[14px] md:px-8 md:py-3.5 md:text-[15px]"
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
              className="inline-flex items-center rounded-lg bg-white px-6 py-3 text-[14px] font-bold text-shop-ink ring-1 ring-shop-edge transition-colors hover:ring-shop-primary md:px-8 md:py-3.5 md:text-[15px]"
            >
              Browse categories
            </Link>
          </div>
        </div>
      )}

      {offers.length > 0 && (
        /* Flex with equal `flex-1` children rather than `grid-cols-3`: the shop
           writes between one and three of these, and a fixed three-column grid
           holding one chip leaves two thirds of the row empty — which reads as
           two offers that failed to load rather than as one offer. */
        <ul className="mt-2.5 flex gap-2 md:mt-3">
          {offers.map((offer) => (
            <li key={offer.headline} className="min-w-0 flex-1">
              <Link
                href={offer.url || "/sale"}
                className="flex h-full flex-col justify-center rounded-xl bg-white px-3 py-2.5 ring-1 ring-shop-edge transition-colors hover:ring-shop-primary md:px-4 md:py-3"
              >
                {offer.badge && (
                  <span className="mb-1 w-fit rounded bg-shop-primary-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-shop-primary-ink">
                    {offer.badge}
                  </span>
                )}
                <span className="truncate text-[12px] font-bold text-shop-ink md:text-[13px]">
                  {offer.headline}
                </span>
                {/* The qualifying half of an offer. "Extra 20% off" is the hook;
                    "on toys, over UGX 50,000" is what it means, and a chip that
                    prints only the first is the kind shoppers stop believing. */}
                {offer.note && (
                  <span className="truncate text-[11px] text-shop-muted">{offer.note}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
