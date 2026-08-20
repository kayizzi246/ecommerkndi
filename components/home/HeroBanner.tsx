import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
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

/** The three promises along the foot of the banner. */
const FEATURES = [
  {
    label: "BIG DEALS",
    detail: "Everyday",
    // A price tag.
    path: "M20.6 13.4 12 4.8A2 2 0 0 0 10.6 4H5a1 1 0 0 0-1 1v5.6a2 2 0 0 0 .6 1.4l8.6 8.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.6Z",
    dot: true,
  },
  {
    label: "FAST DELIVERY",
    detail: "Across Uganda",
    // A delivery van.
    path: "M3 7h10v8H3zM13 10h4l3 3v2h-7zM7 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 19Zm10 0a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 17 19Z",
  },
  {
    label: "SAFE & SECURE",
    detail: "Shopping",
    // A shield with a tick.
    path: "M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Zm-.7 11.6L8.6 12.4l1.3-1.3 1.4 1.4 3.5-3.5 1.3 1.3-4.8 4.8Z",
  },
];

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
 * by a shopkeeper — sized by `h-auto` plus a max-height cap precisely so that
 * whatever arrives is shown at its own aspect ratio. Declaring a ratio we do
 * not know is what cropped the artwork.
 *
 * The optimiser is a plain URL endpoint, so an `<img>` can use it directly and
 * keep `h-auto` exactly as it was. The endpoint is public API — the shape of
 * these URLs is in the `next/image` docs — and the `srcSet` below is the same
 * set of widths `<Image>` would have emitted.
 *
 * `q=75` is the optimiser's default quality and the one value certain to be
 * accepted; a quality outside the configured set is another 400.
 *
 * A src that is not an absolute http(s) URL is returned untouched: the built-in
 * hero's own artwork is a local file, and a data: URI would be nonsense to send
 * through a resizer.
 */
function optimised(src: string, width: number): string {
  if (!/^https?:\/\//i.test(src)) return src;

  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

/**
 * The same banner at every configured width, for the browser to choose from.
 *
 * `sizes="100vw"` at the call site is the truth — the hero is full-bleed — so a
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
}: {
  settings: SiteSettings;
  href?: string;
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
  /** True when the image on phones is a purpose-made portrait crop. */
  const mobileIsPortrait = Boolean(narrow);

  if (mobileSrc && desktopSrc) {
    return (
      <section aria-label={image_alt || "Featured offer"}>
        <Link href={image_href || "/sale"} className="block">
          {/* ---- Why two <Image>s and not one with a srcset ----
               `next/image` chooses between sizes of the SAME picture. These are
               two DIFFERENT pictures — a wide desktop crop and a tall phone
               crop, laid out differently, usually with different wording — which
               is art direction, and art direction is a `<picture>`-shaped
               problem rather than a `srcset`-shaped one.

               Rendering both and letting CSS pick looks wasteful and is not:
               `hidden` on the wrapper means the browser never fetches the image
               inside it, because it has no layout box. Only one is ever
               downloaded.

               When only ONE file has been uploaded both of these point at it,
               and that is deliberate rather than wasteful. The hidden one is
               never fetched, and if the visible one changes across a resize the
               URL is identical so it comes from cache. It keeps the markup to a
               single shape instead of three conditional branches. */}
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

               ---- The height cap, which now engages on purpose ----

               `h-auto` still means natural height, and the caps are what stop
               it: at 1600px wide a 2.4:1 banner is 655px tall and a 3:1 banner
               is 533px, and the old caps sat ABOVE both, so they never fired
               and the banner took most of the first screen. A shopper arriving
               on this page scrolled past one picture to reach the catalogue,
               which is the thing they came for.

               The caps are lower than any sensible banner's natural height
               now, so they always engage and the band is a known height:
               roughly 560px on a desktop and 300 on a phone. That is a crop,
               and it is affordable because of the pairing with
               `object-center` — a banner is designed with its subject and its
               wording in the middle third, so what comes off is the margin at
               the top and bottom. The guidance to upload a wide, centred image
               is what makes this safe; a banner with copy running to its top
               edge will lose it.

               The mobile caps are lower again, because a phone screen is
               shorter and the same proportion of it is a much larger share of
               what can be seen at once.

               ---- Desktop is a flat 280px band ----

               440/560 was still half a laptop screen, and the shop asked for
               the banner to stop being the page. 280px at every desktop width
               is the answer: one number rather than two, so the band does not
               grow as the window does, and the first rail of products is on the
               first screen at any size.

               That is a harder crop than before, so the guidance to compose
               wide with the wording in the middle third is now the thing that
               makes a banner work rather than a nicety. The phone caps are
               unchanged — a phone shows the banner much narrower, so its
               natural height is already close to the band. */}
          {/* eslint-disable @next/next/no-img-element */}
          <img
            src={optimised(mobileSrc, 1080)}
            srcSet={heroSrcSet(mobileSrc)}
            sizes="100vw"
            alt={image_alt}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className={`h-auto w-full object-cover object-center md:hidden ${
              mobileIsPortrait ? "max-h-[440px]" : "max-h-[300px]"
            }`}
          />
          <img
            src={optimised(desktopSrc, 1920)}
            srcSet={heroSrcSet(desktopSrc)}
            sizes="100vw"
            alt={image_alt}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="hidden h-auto w-full object-cover object-center md:block md:max-h-[280px] lg:max-h-[280px]"
          />
          {/* eslint-enable @next/next/no-img-element */}
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
        /* Sized to the image cap above, so the hero is the same band whether
           the shop uploaded a banner or is running the drawn fallback —
           otherwise switching one for the other in wp-admin moves the whole
           page up or down. From md the padding is 16px and the photograph is
           fixed at 248px, which puts the band at the same 280px the uploaded
           banner is capped to. The type and the feature discs come down a step
           with it so the copy column still fits inside that height rather than
           being clipped by the section's `overflow-hidden`. */
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
            <span className="text-[12px] font-bold tracking-[0.12em] text-shop-primary-ink">
              BIG SAVINGS
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
            className="mt-3 font-heading text-[34px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-shop-ink sm:text-[46px] md:mt-2 md:text-[38px] lg:text-[46px]"
          >
            Buy more
            <span className="block text-shop-primary">Spend less</span>
          </h2>

          <p className="mt-3.5 max-w-[46ch] text-[15px] leading-relaxed text-shop-body md:mt-2 md:text-[15px]">
            More items. Better deals.
            <br className="hidden sm:block" /> Unbeatable prices on{" "}
            <span className="font-bold text-shop-ink">everything you love</span>.
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

               These are the only claims on the banner and all three are true of
               this shop: the deals are the rails below, delivery is countrywide
               and the terms are in the footer. Nothing here invents a promise
               the checkout does not keep. */}
          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-4 md:mt-4 md:gap-x-6">
            {FEATURES.map((feature, index) => (
              <li
                key={feature.label}
                className={`flex items-center gap-2.5 ${
                  // Hairline dividers between the three, as in the original —
                  // but only from sm up. When they wrap onto two lines on a
                  // narrow phone a vertical rule lands in mid-air.
                  index > 0 ? "sm:border-l sm:border-shop-line sm:pl-5 md:pl-7" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-shop-primary to-shop-ember text-white md:h-8 md:w-8">
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
          <div className="relative order-1 w-[210px] shrink-0 sm:w-[260px] md:order-none md:h-[248px] md:w-auto">
            <Image
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
              sizes="(min-width: 768px) 210px, 260px"
            />

            {/* The SHOP NOW disc — desktop only, for the reasons on the phone
                button above. Positioned over the photograph's top-right, which
                is where it sits in the original.

                A real `<Link>` with the disc as its shape, so the whole circle
                is the hit area and it is reachable by keyboard with a visible
                focus ring. */}
            <Link
              href={href}
              className="btn-shop absolute -right-2 top-2 hidden h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-shop-primary to-shop-ember text-center text-[14px] font-bold uppercase leading-tight text-white transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shop-primary-ink md:flex md:h-[84px] md:w-[84px] md:text-[13px]"
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
