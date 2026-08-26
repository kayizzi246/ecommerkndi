import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/currency";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * The homepage hero.
 *
 * TWO modes, and which one runs is decided in wp-admin rather than here:
 *
 *   1. UPLOADED. "Kandi Storefront → Hero image" has a banner in it. That
 *      artwork is shown full width, linked, and nothing is drawn over it. A
 *      second, taller crop can be uploaded for phones. This is the mode to use
 *      for a campaign — the shop can change its hero without a deploy, which is
 *      the whole point of putting it in settings.
 *
 *   2. BUILT-IN. No banner uploaded — the shipped state. Everything below is
 *      rendered instead: the "BUY MORE / SPEND LESS" hero as live text, with
 *      the orange disc, the badge, the three promises and a real SHOP NOW link.
 *
 * Mode 2 is the fallback rather than the exception, deliberately. A shop that
 * never opens the settings screen still has a hero, and one that deletes its
 * banner lands on something rather than on a hole in the top of the page.
 *
 * ---- Why the built-in one is markup rather than a picture ----
 *
 * This exists as a flat 1993×816 JPEG with the headline, the badge, the button
 * and the three feature pills all baked into the pixels. It is not used that
 * way, and the reason is arithmetic rather than preference.
 *
 * That image is 2.4:1 with its copy occupying the left half. Rendered full
 * width on a 390px phone it is about 160px tall, which puts "BUY MORE SPEND
 * LESS" at roughly 13px and the three feature pills below the size at which
 * they are letters at all. Most of this shop's traffic is on a phone. A hero
 * whose message is unreadable on the majority device is not a hero; it is a
 * decorative band that costs a download and pushes the first product further
 * down the page.
 *
 * Rebuilt as markup, every one of those problems goes away and several other
 * things come free:
 *
 *   • It restacks. Photograph on top, copy beneath, full-width button — the
 *     layout a phone actually wants, rather than a desktop layout shrunk.
 *   • The headline is text. It is selectable, it is translatable, a screen
 *     reader reads it, and Google indexes it. On the flat version the shop's
 *     single largest on-page statement was invisible to all four.
 *   • SHOP NOW is a real link with a real hit area, not a circle somebody has
 *     to guess is clickable.
 *   • The copy is edited here in seconds. On the flat version every wording
 *     change is a round trip through a design tool and a re-export.
 *   • It is smaller. One cutout PNG instead of a full-bleed photographic JPEG
 *     carrying its own typography.
 *
 * ---- The one asset the built-in mode wants ----
 *
 * `public/hero-model.png` — the shopper with the KandiUg bags, cut out with a
 * TRANSPARENT background. Everything else in that mode is drawn here.
 *
 * It renders correctly without the file: if it is absent the photo column
 * simply does not render and the copy takes the full width, so the homepage is
 * never broken by a missing asset and never ships a 404'd image. Drop the file
 * in and it appears — no code change. It is in `public/` rather than in
 * settings because it is a fixed part of THIS hero's composition, not a slot;
 * the swappable-in-wp-admin thing is mode 1 above.
 */

/**
 * Whether the cutout has been added to `public/` yet.
 *
 * Checked on the server at render rather than assumed, because the failure mode
 * of assuming is a broken image icon in the most prominent position on the
 * shop. `public/` is read-only at runtime and this is a stat call on a path
 * that the OS has cached, on a page that is already doing WooCommerce fetches.
 */
function hasModelCutout() {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", "hero-model.png"));
  } catch {
    return false;
  }
}

/**
 * The three promises along the foot of the banner.
 *
 * ---- Why these are a function of settings and not three constants ----
 *
 * They used to be "BIG DEALS / Everyday", "FAST DELIVERY / Across Uganda" and
 * "SAFE & SECURE / Shopping", and every one of those is a slogan rather than a
 * fact. None of them told a shopper anything they could act on: "Everyday" is
 * not a claim, "Across Uganda" is not a timeframe, and "SAFE & SECURE
 * Shopping" is what a page says when it has nothing specific to offer. Three
 * capitalised abstractions in a row is the single loudest tell that copy was
 * generated rather than written by somebody who knows the business.
 *
 * The shop has real numbers for all three — the delivery threshold and the
 * returns window are in Store Settings, and the delivery window is on the
 * shipping page — so the banner now prints those instead. They also stay
 * correct when the shopkeeper changes them, which a hardcoded slogan cannot.
 *
 * The three icons are unchanged: a price tag, a van and a shield still match
 * what is being said beside them.
 */
function features(settings: SiteSettings) {
  return [
    {
      label: `Free delivery over ${formatPrice(settings.commerce.free_delivery_from)}`,
      detail: "On every order that reaches it",
      // A price tag.
      path: "M20.6 13.4 12 4.8A2 2 0 0 0 10.6 4H5a1 1 0 0 0-1 1v5.6a2 2 0 0 0 .6 1.4l8.6 8.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.6Z",
      dot: true,
    },
    {
      label: "Kampala in 1–2 days",
      detail: "Upcountry within five",
      // A delivery van.
      path: "M3 7h10v8H3zM13 10h4l3 3v2h-7zM7 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 19Zm10 0a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 17 19Z",
    },
    {
      label: `${settings.commerce.returns_days} days to send it back`,
      detail: "Faulty or wrong, we pay both ways",
      // A shield with a tick.
      path: "M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Zm-.7 11.6L8.6 12.4l1.3-1.3 1.4 1.4 3.5-3.5 1.3 1.3-4.8 4.8Z",
    },
  ];
}

/**
 * The widths the hero is encoded at, and the only ones it may ask for.
 *
 * Every value here must appear in `images.deviceSizes` — Next's optimiser
 * answers 400 to a width it was not configured for, and a 400 on the LCP image
 * is a blank band at the top of the homepage. These four are all defaults; if
 * `deviceSizes` is ever narrowed in next.config.ts, narrow this too.
 */
const HERO_WIDTHS = [640, 828, 1080, 1920] as const;

/**
 * A banner URL, routed through Next's image optimiser.
 *
 * ---- The problem this solves, measured ----
 *
 * The uploaded hero is whatever file the shop dropped into wp-admin, served
 * straight from the WordPress host. On this shop that is a 533KB PNG, and the
 * WordPress host answered it in 5.8 seconds. It is the LCP element of the
 * homepage, it is marked `fetchPriority="high"`, and it was being fetched from
 * a shared host in front of every shopper on a Ugandan mobile connection.
 * Nothing else on the page — no cache window, no prerender — matters next to
 * six seconds of blank band above the catalogue.
 *
 * `/_next/image` fixes all three parts of that at once: it resizes to the
 * width actually being shown, re-encodes to WebP (see `formats` in
 * next.config.ts), and serves the result from the deployment's CDN with the
 * 31-day cache configured there. The same banner lands as a WebP of roughly a
 * tenth the bytes, from an edge instead of from WordPress.
 *
 * ---- Why the URL is built by hand instead of using <Image> ----
 *
 * This is the second time `next/image` has been taken off this element, and
 * the reason it came off the first time has not changed: `<Image>` requires
 * `width` and `height`, it writes them onto the tag, and the rendered box then
 * follows THOSE numbers rather than the file's own proportions. The hero is a
 * file of unknown shape — a wide campaign banner or a tall phone crop, uploaded
 * by a shopkeeper — sized by a width and `h-auto` precisely so that whatever
 * arrives is shown at its own aspect ratio. Declaring a ratio we do not know
 * is what cropped the artwork.
 *
 * The optimiser is a plain URL endpoint, so an `<img>` can use it directly and
 * keep `h-auto` exactly as it was. The endpoint is public API — the shape of
 * these URLs is in the `next/image` docs — and the `srcSet` below is the same
 * set of widths `<Image>` would have emitted.
 *
 * `q=90` matches the quality every `<Image>` in the shop now asks for, and it
 * is in `images.qualities` in `next.config.ts` — which is not optional. This
 * URL is hand-built, so nothing type-checks it: a quality outside the
 * configured set is a 400 from the optimiser and a hero that does not render.
 * The two have to be changed together, and this is the only place in the shop
 * where that coupling is not enforced by the compiler.
 *
 * A src that is not an absolute http(s) URL is returned untouched: the built-in
 * hero's own artwork is a local file, and a data: URI would be nonsense to send
 * through a resizer.
 */
function optimised(src: string, width: number): string {
  if (!/^https?:\/\//i.test(src)) return src;

  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=90`;
}

/**
 * The same banner at every configured width, for the browser to choose from.
 *
 * `sizes` at the call site is the truth — a phone hero is full-bleed and a desktop one fills the shell — so a
 * 390px phone takes the 640 and a desktop takes the 1920, and neither pays for
 * the other's file.
 */
function heroSrcSet(src: string): string | undefined {
  if (!/^https?:\/\//i.test(src)) return undefined;

  return HERO_WIDTHS.map((width) => `${optimised(src, width)} ${width}w`).join(", ");
}

export default function HeroBanner({
  settings,
  /** Where SHOP NOW goes. The sale page by default — the banner is about price. */
  href = "/sale",
  /**
   * Render nothing when no banner has been uploaded, instead of falling back to
   * the built-in text hero.
   *
   * The fallback is right for the slot this component was built for — the top
   * of the page, where something has to be there. It is wrong for a promo slot
   * further down: a shop that has not uploaded a banner should get no banner,
   * not a second hero wedged between two rails of merchandise.
   */
  imageOnly = false,
  /**
   * Suppress the LCP preload.
   *
   * The two `<link rel="preload">` tags below are correct for a banner in the
   * first screen and actively harmful anywhere else: preloading a below-the-fold
   * image at `fetchPriority="high"` makes it compete with whatever the real
   * Largest Contentful Paint is — here, the first row of product photographs.
   * A promo strip halfway down the page must not outrank the goods.
   */
  priority = true,
}: {
  settings: SiteSettings;
  href?: string;
  imageOnly?: boolean;
  priority?: boolean;
}) {
  /* ---- An uploaded banner wins, and takes the whole width ----
   *
   * `banner.image_url` is set in wp-admin under "Kandi Storefront → Hero image".
   * When it is present the shop's own artwork replaces the built-in hero
   * entirely — no headline drawn over it, no orange disc on top of it, nothing
   * competing with a design somebody already made. The one thing this component
   * still owns is making it span the full width and linking it.
   *
   * When it is absent the built-in text hero below runs instead. That is the
   * shipped state, so a shop that never opens the settings screen still has a
   * hero, and one that removes its banner falls back to something rather than
   * to a gap.
   */
  const { image_url: wide, image_mobile_url: narrow, image_href, image_alt } = settings.banner;

  /* ---- EITHER field turns the uploaded hero on ----
   *
   * This used to test `wide` alone, and that was a bug worth recording because
   * it failed silently and looked exactly like a broken setting. Uploading only
   * the phone banner — which is the reasonable thing to do first, since the
   * admin screen presses hard for a phone crop — left `wide` empty, so the
   * whole uploaded branch was skipped and the shop kept drawing its built-in
   * hero. The banner was saved, correct, and being ignored, with nothing
   * anywhere to say so.
   *
   * Neither field is more important than the other. Both are optional and
   * either one alone is a complete answer:
   *
   *   both        phone crop below md, wide one from md up
   *   wide only   the wide one at every width
   *   phone only  the phone one at every width
   *   neither     the built-in text hero
   *
   * The height caps follow the SOURCE rather than the breakpoint, which is the
   * subtle part. A portrait phone crop needs a tall cap or it is cropped to a
   * letterbox; a wide banner shown on a phone needs the short one or it eats
   * the screen. When one file is doing both jobs the cap has to be chosen from
   * what the file actually is, not from where it is being shown.
   */
  const mobileSrc = narrow || wide;
  const desktopSrc = wide || narrow;

  // Asked for the uploaded banner and there is none: draw nothing. See the
  // `imageOnly` prop for why a promo slot must not inherit the text hero.
  if (imageOnly && !(mobileSrc && desktopSrc)) return null;

  if (mobileSrc && desktopSrc) {
    return (
      <section aria-label={image_alt || "Featured offer"}>
        {/* ---- Preload, because this is the LCP element ----
         *
         * React 19 hoists a `<link>` rendered anywhere in the tree into the
         * document head, so these two lines put the banner's fetch at the top
         * of the HTML — ahead of the stylesheet, the fonts and the whole
         * component tree the browser would otherwise have to parse before it
         * discovered the `<img>` below.
         *
         * The hero sits under a header, a nav bar and an announcement strip.
         * None of that is heavy, but the discovery order is still "parse the
         * chrome, then find the image, then open the connection", and on a
         * Ugandan mobile connection that ordering is worth several hundred
         * milliseconds on the one element the page is judged by.
         *
         * `media` is what keeps this from undoing the `<picture>` above: a
         * phone evaluates only the first line and a desktop only the second,
         * so exactly one banner is preloaded and it is the same one that will
         * be painted. `imageSrcSet` and `imageSizes` have to match the tag
         * they are preloading EXACTLY — a mismatch means the browser picks a
         * different candidate and the preload is a second download rather than
         * a head start, which is worse than not preloading at all. Change
         * these and the `<picture>` below in the same edit.
         */}
        {priority && (
          <>
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
          imageSizes="(min-width: 1720px) 1656px, 100vw"
          fetchPriority="high"
        />
          </>
        )}
        <Link href={image_href || "/sale"} className="block">
          {/* ---- Why two <Image>s and not one with a srcset ----
               `next/image` chooses between sizes of the SAME picture. These are
               two DIFFERENT pictures — a wide desktop crop and a tall phone
               crop, laid out differently, usually with different wording — which
               is art direction, and art direction is a `<picture>`-shaped
               problem rather than a `srcset`-shaped one.

               This used to be two `<img>`s, one hidden per breakpoint, on the
               belief that `display: none` stops the fetch. It does not. Chrome
               and Firefox both download an eager `<img>` inside a hidden
               container, so the LCP element of the homepage was fetching TWO
               banners on every device, both at `fetchPriority="high"`,
               competing with each other for the one connection that matters.
               On the shipped artwork that is most of a hundred kilobytes of a
               phone's first screen spent on a file it will never paint.

               `<picture>` is the primitive that actually decides: the browser
               evaluates `media` on the `<source>` and fetches exactly one
               resource. Same art direction, half the bytes.

               When only ONE file has been uploaded, both entries point at it
               and the URL is identical, so a resize across 768px repaints from
               cache rather than fetching again. */}
          {/* ---- Why these are plain <img> and not next/image ----

               This is the fix for a banner arriving with its bottom row cut
               off, and the cause was subtler than the height cap it looked
               like.

               `next/image` REQUIRES `width` and `height`, and the browser
               computes the element's aspect ratio from those two numbers — not
               from the file. So declaring 1920×800 does not describe the
               upload, it DEFINES a 2.4:1 box, and `object-cover` then crops
               whatever was actually uploaded to fit it. A 3:1 banner (the shape
               the admin screen asks for) was being cropped to 2.4:1 before any
               height cap was even consulted, and the crop was invisible in the
               code because the numbers looked like a description.

               There is no correct pair of numbers to declare here. The shop can
               upload any shape it likes and only the FILE knows what that shape
               is. A plain `<img>` with no dimensions lets the browser read the
               intrinsic size and lay the element out at the image's own ratio,
               which is the only arrangement where an arbitrary upload renders
               uncropped.

               Nothing is given up by dropping `next/image` here. These are
               already `unoptimized` — the file lives in the WordPress media
               library, which is not necessarily in `next.config`
               remotePatterns — so the component was contributing no resizing,
               no format conversion and no optimisation. It was contributing the
               forced aspect ratio, which is exactly the bug.

               `fetchPriority="high"` and `loading="eager"` replace `priority`.
               This is the first element on the page and almost certainly its
               LCP, so it must not be lazy.

               ---- The crop, and why it is back ----

               The banner once arrived with its bottom row sliced in half. It
               was `object-cover` plus `max-h-[450px]` on a full-BLEED
               element: on a 1920px screen a 2.44:1 banner wanted to be 787px
               tall, the cap said 450, and 337px of artwork went. That was
               fixed by removing the crop, and then the band was fixed at 450,
               which puts a crop back on a shorter band.

               The difference between the two is the width the shop is being
               asked to draw for. The old arrangement cropped whatever was
               uploaded to a ratio nobody had been told — a moving one, since
               the box was as wide as the window. This one is a stated box:
               1436 x 450, about 3.2:1, the same on every screen from 1500 up.
               A banner made at that ratio is shown whole. A banner made at
               2.44:1 loses its outer bands, which on the shipped artwork
               means the dotted corner and the feature strip.

               So the rule to hold on to is that the band height and the
               upload ratio are ONE decision. Changing 450 here without
               telling the shop the new ratio is what produced the sliced
               banner the first time.

               ---- Where it landed: the shell wide, 450px tall ----

               The banner is `w-full` inside a `max-w-[var(--shell)]` wrapper
               carrying the shell's own `md:px-8` gutter, so the artwork
               starts and ends exactly where the product grid below it does.
               With `--shell: 1500px` that box is 1436 CSS pixels wide.

               The old `max-w-[1100px]` is gone and is not coming back. It
               existed to survive full bleed: with `--shell: 100%` a 2.44:1
               banner on a 1920px window wanted to be 787px tall, so the pair
               of caps held it to 450 by making it 1100 wide — uncropped and
               correct, but visibly narrower than the page it sat on, which is
               the part that read as broken. A bounded shell removes that
               problem: the banner and the grid share two edges.

               The HEIGHT is a different decision, made after this one and
               against the grain of the section above. 1436 at 2.44:1 is a
               588px band, which is most of a laptop screen before a single
               product appears, so the band is pinned at 450 and the picture
               is `object-cover`ed into it. That is a crop, knowingly — see
               the note on the tag itself for exactly what it costs and for
               the upload ratio that costs nothing.

               `mx-auto` centres it, and `md:rounded-2xl` gives it the same
               corner as the department rails below, so a banner narrower than
               the window reads as a deliberate hero rather than as an image
               that failed to load full width.

               The `mobileIsPortrait` flag that used to pick between a 440 and
               a 300 cap is gone with the caps. The art direction it was part
               of is not: there are still two entries below because a phone
               crop and a desktop crop are two different pictures, which is a
               `<picture>`-shaped problem and not a `srcSet`-shaped one. */}
          {/* ---- The wrapper is the shell ----
              `max-w-[var(--shell)]` plus the same `md:px-8` every other
              container on the page carries, so from md up the banner's two
              edges are the product grid's two edges. Below md it has no
              padding, and that is what makes the phone banner full bleed: the
              homepage keeps a 12px gutter so its product cards read as cards,
              and the hero is the one block that opts out — a picture with a
              sliver of page down each side reads as a layout mistake rather
              than as a hero. */}
          <div className="mx-auto w-full max-w-[var(--shell)] md:px-8">
            <picture>
              {/* The desktop crop, from 768px up. `sizes` is the painted box:
                  1436 CSS pixels on any window from 1500 up, and the window
                  itself below that. A flat `100vw` would have a 1920px monitor
                  download the 1920 file for a 1436px box; this asks for the
                  file that fits, and a 2x display still takes the 1920 from
                  the srcSet, which is what it needs. */}
              <source
                media="(min-width: 768px)"
                srcSet={heroSrcSet(desktopSrc) ?? optimised(desktopSrc, 1920)}
                sizes="(min-width: 1720px) 1656px, 100vw"
              />
              {/* The `<img>` carries the PHONE crop and is also the element a
                  matching `<source>` paints into, so its classes describe both
                  states.

                  Below md: `h-auto w-full`, the whole picture at its own
                  ratio. A phone is 390px wide, so a 2.44:1 banner is 160px
                  tall there and a purpose-made portrait crop is about 520 —
                  both are heights a shop chose by choosing that file, and
                  neither needs a cap.

                  From md: a 450px band, full width, square corners. Both
                  dimensions are fixed — `w-full` and `h-[450px]` — so the box
                  stops following the file's own ratio, and `object-cover` is
                  what keeps that from stretching the artwork. It crops
                  instead: at 1436 wide a 2.44:1 upload wants 588px, the band
                  shows 450, and `object-center` takes the 450 out of the
                  middle. Around an eighth of such a file is lost off the top
                  and the same off the bottom.

                  That crop is a real cost, so it is worth saying where it
                  lands: a band this short shows a whole picture only if the
                  picture is drawn for it. 1436 x 450 is about 3.2:1, so a
                  banner uploaded at that ratio (2880 x 900 for a 2x screen)
                  fills the band with nothing cropped. A 2.44:1 file loses its
                  outer bands — on the shipped artwork, the dotted corner off
                  the top and the feature strip off the bottom.

                  No `rounded-2xl`: at 450px the band reads as a strip of page
                  rather than as a card on it, and a rounded strip reads as a
                  card that failed to fill its slot. */}
              <img
                src={optimised(mobileSrc, 1080)}
                srcSet={heroSrcSet(mobileSrc)}
                sizes="100vw"
                alt={image_alt}
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="h-auto w-full md:h-[550px] md:object-cover md:object-center"
              />
            </picture>
          </div>
        </Link>
      </section>
    );
  }

  const withPhoto = hasModelCutout();

  return (
    <section
      aria-labelledby="hero-heading"
      /* Edge to edge on a phone, rounded from md — the same rule the department
         rails follow, so the hero belongs to the page rather than sitting on
         top of it.

         The ground is a very soft warm-to-cool wash rather than flat white. On
         a white content sheet a white banner would have no edges at all, and
         this is the one block on the page that has to read as a single object
         before anything in it is read. */
      className="relative overflow-hidden bg-gradient-to-br from-shop-cream via-white to-shop-surface md:rounded-2xl"
    >
      {/* ---- The orange quarter-disc, top left ----
           Decorative, and drawn rather than photographed so it scales without a
           file. `aria-hidden` because it says nothing; it is the shape that
           makes the banner look designed instead of typed.

           Sized in vw at the small end so it stays in proportion on a phone
           rather than swallowing the corner. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-shop-primary to-shop-ember opacity-90 md:-left-20 md:-top-24 md:h-64 md:w-64"
      />

      {/* ---- The dot field, bottom left ----
           The other decorative element from the original. A repeating radial
           gradient, so it is CSS rather than an image and costs nothing. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-4 left-4 hidden h-20 w-28 opacity-45 md:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--color-shop-primary) 1.6px, transparent 1.7px)",
          backgroundSize: "12px 12px",
        }}
      />

      <div
        /* A 450px band: 16px of padding from md around a photograph fixed at
           418px. This used to be the same height as the uploaded banner,
           which was capped at 450 — switching one for the other in wp-admin
           moved nothing on the page.

           The pairing still holds, by a different route. The uploaded banner
           is a fixed 450px band now — a stated height with the picture
           `object-cover`ed into it, rather than a cap a ratio might not
           reach — so the two heroes are the same height again and switching
           one for the other in wp-admin still moves nothing.

           They have to be changed TOGETHER, and this one is the harder half:
           it is TYPE — headline, badge, three promises and a button — and
           type does not rescale with its container the way a photograph does.
           Moving the band means retuning the scale in the copy column below,
           not editing this number on its own.

           The type and the feature discs come down a step with it so the copy
           column still fits inside that height rather than being clipped by
           the section's `overflow-hidden`. */
        className={`relative mx-auto flex max-w-[var(--shell)] flex-col items-center gap-5 px-5 py-6 md:flex-row md:gap-8 md:px-10 md:py-4 ${
          withPhoto ? "" : "md:justify-center md:text-center"
        }`}
      >
        {/* ---- Copy ----
             First in the DOM at every width. On a phone it is ORDERED second
             visually (`order-2`) so the photograph leads, which is what a
             shopper responds to on a small screen — but a screen reader and a
             crawler still get the headline before the decoration. */}
        <div className="order-2 min-w-0 flex-1 md:order-none">
          {/* The badge. An outlined pill rather than a filled one: it sits
              above a very heavy headline and a solid orange block here would
              compete with the word "SPEND LESS" directly below it. */}
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-shop-primary/35 bg-white/70 px-3.5 py-1.5">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4 text-shop-primary"
              fill="currentColor"
            >
              <path d="M7 7V6a5 5 0 0 1 10 0v1h2.2a1 1 0 0 1 1 1.1l-1.2 12A2 2 0 0 1 17 22H7a2 2 0 0 1-2-1.9l-1.2-12A1 1 0 0 1 4.8 7H7Zm2 0h6V6a3 3 0 1 0-6 0v1Z" />
            </svg>
            {/* "BIG SAVINGS" was here, which is a shout and not a fact. The
                sale page is a real page with a real count of reduced products
                on it; naming it is both more concrete and more useful. */}
            <span className="text-[12px] font-bold tracking-[0.12em] text-shop-primary-ink">
              TODAY&rsquo;S REDUCTIONS
            </span>
          </span>

          {/* ---- The headline ----
               An `<h2>`, not an `<h1>`. The homepage's `<h1>` lives in the
               about block at the foot of the page and carries "KandiUg" and
               "Online shopping in Uganda" — the phrases this site actually
               ranks for. "BUY MORE SPEND LESS" is a promotion, not a
               description of the business, and promoting it to `<h1>` would
               trade the shop's own name for a slogan. See `app/page.tsx`.

               Fluid from 34px to 68px. The original is a fixed-size image, so
               its type was one size scaled up and down; real text can be sized
               for the screen it is on, and the small end here is chosen to fit
               "SPEND LESS" on one line at 360px. */}
          <h2
            id="hero-heading"
            className="mt-3 font-heading text-[34px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-shop-ink sm:text-[46px] md:mt-3 md:text-[46px] lg:text-[56px]"
          >
            Buy more
            <span className="block text-shop-primary">Spend less</span>
          </h2>

          {/* This read "More items. Better deals. Unbeatable prices on
              everything you love." — three claims, none of them checkable, and
              "everything you love" is addressed to nobody in particular. What a
              shopper landing here actually wants to know is what is on the shop
              and what it costs to get it home, so that is what it says now. */}
          <p className="mt-3.5 max-w-[46ch] text-[15px] leading-relaxed text-shop-body md:mt-3 md:text-[16px]">
            Shoes, clothing, electronics and home essentials
            <br className="hidden sm:block" /> from{" "}
            <span className="font-bold text-shop-ink">Ugandan sellers we have vetted</span>.
          </p>

          {/* The phone-sized call to action.
              On desktop the button is the orange disc over the photograph,
              which is the original design and works there because the eye
              arrives at the photo. On a phone that disc would either overlap
              the model's face or shrink below a comfortable tap target, so the
              CTA becomes an ordinary full-width button under the copy — where a
              thumb already is. Only ever one of the two is rendered. */}
          <Link
            href={href}
            className="btn-shop mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-shop-primary to-shop-ember px-7 py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 sm:w-auto sm:self-start md:hidden"
          >
            SHOP NOW
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
            </svg>
          </Link>

          {/* ---- The three promises ----
               A row on desktop, a row that wraps on a phone. Each is an orange
               disc, a bold label and a quiet detail line — the original's
               anatomy exactly.

               Every figure in them is the shop's own: see `features()` above
               for why they are read from settings rather than typed. Nothing
               here invents a promise the checkout does not keep, and nothing
               here is a slogan standing in for one. */}
          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-4 md:mt-6 md:gap-x-7">
            {features(settings).map((feature, index) => (
              <li
                key={feature.label}
                className={`flex items-center gap-2.5 ${
                  // Hairline dividers between the three, as in the original —
                  // but only from sm up. When they wrap onto two lines on a
                  // narrow phone a vertical rule lands in mid-air.
                  index > 0 ? "sm:border-l sm:border-shop-line sm:pl-5 md:pl-7" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-shop-primary to-shop-ember text-white md:h-9 md:w-9">
                  <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor">
                    <path d={feature.path} />
                    {feature.dot && <circle cx="8" cy="8" r="1.3" fill="var(--color-shop-primary)" />}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold leading-tight text-shop-ink">
                    {feature.label}
                  </span>
                  <span className="block text-[12.5px] leading-tight text-shop-muted">
                    {feature.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- The photograph, and the disc button over it ----
             Rendered only when the cutout exists. See `hasModelCutout`. */}
        {withPhoto && (
          <div className="relative order-1 w-[210px] shrink-0 sm:w-[260px] md:order-none md:h-[418px] md:w-auto">
            <Image
              quality={90}
              src="/hero-model.png"
              alt=""
              /* Empty alt, `aria-hidden` by consequence: the banner's message is
                 the headline beside it, which is real text. Describing the
                 photograph as well would make a screen reader read the same
                 promotion twice. */
              aria-hidden
              width={760}
              height={900}
              /* The banner is the first thing on the page and this is very
                 likely its LCP element, so it loads eagerly at high priority
                 rather than lazily. It is one image, above the fold, on every
                 visit — the case `priority` was made for. */
              priority
              className="h-auto w-full object-contain md:h-full md:w-auto"
              sizes="(min-width: 768px) 320px, 260px"
            />

            {/* The SHOP NOW disc — desktop only, for the reasons on the phone
                button above. Positioned over the photograph's top-right, which
                is where it sits in the original.

                A real `<Link>` with the disc as its shape, so the whole circle
                is the hit area and it is reachable by keyboard with a visible
                focus ring. */}
            <Link
              href={href}
              className="btn-shop absolute -right-2 top-2 hidden h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-shop-primary to-shop-ember text-center text-[14px] font-bold uppercase leading-tight text-white transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shop-primary-ink md:flex md:h-[104px] md:w-[104px] md:text-[15px]"
            >
              Shop
              <span>Now</span>
              <span aria-hidden className="mt-1.5 h-[3px] w-7 rounded-full bg-white/90" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
