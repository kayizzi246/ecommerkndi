import type { SiteSettings } from "@/lib/site-settings";

/**
 * App Store and Google Play badges.
 *
 * Two states, driven by "App is live" in wp-admin → Kandi Storefront:
 *   • off (the default) — the badges render greyed out with a "Coming soon"
 *     ribbon and are not links, so nobody taps through to a listing that does
 *     not exist yet;
 *   • on — each badge becomes a real link to the store URL that was filled in.
 *     A badge with no URL stays in the coming-soon state on its own, so you
 *     can ship on Android first without a dead Apple link.
 *
 * The marks are drawn inline rather than loaded as images: no network request,
 * no layout shift, and they stay crisp at any size.
 *
 * NOTE: Apple and Google both require their *supplied* badge artwork on public
 * sites (Apple's Marketing Resources, Google's Play Badge Generator), and both
 * set minimum sizes and clear-space rules. These are faithful stand-ins so the
 * footer is finished today — swap in the official assets before you announce
 * the app.
 */
export default function AppStoreBadges({ app }: { app: SiteSettings["app"] }) {
  const ios = app.available && app.ios_url ? app.ios_url : null;
  const android = app.available && app.android_url ? app.android_url : null;

  return (
    <div className="flex flex-wrap gap-2.5">
      <Badge
        href={ios}
        eyebrow="Download on the"
        name="App Store"
        icon={<AppleMark />}
      />
      <Badge
        href={android}
        eyebrow="Get it on"
        name="Google Play"
        icon={<PlayMark />}
      />
    </div>
  );
}

function Badge({
  href,
  eyebrow,
  name,
  icon,
}: {
  href: string | null;
  eyebrow: string;
  name: string;
  icon: React.ReactNode;
}) {
  const shell =
    "relative flex items-center gap-2.5 rounded-lg border px-3.5 py-2 transition-colors";

  const inner = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] uppercase tracking-wide opacity-75">{eyebrow}</span>
        <span className="mt-0.5 text-[15px] font-semibold">{name}</span>
      </span>
    </>
  );

  if (!href) {
    return (
      <span
        className={`${shell} cursor-default border-shop-line bg-shop-hairline text-shop-muted`}
        // The badge is decorative until the app ships; the ribbon carries the
        // real message, so the whole thing reads as one label.
        aria-label={`${name} — coming soon`}
      >
        <span className="opacity-45 grayscale">{icon}</span>
        <span className="flex flex-col leading-none">
          <span className="text-[10px] uppercase tracking-wide">{eyebrow}</span>
          <span className="mt-0.5 text-[15px] font-semibold">{name}</span>
        </span>
        <span className="ml-1 rounded-full bg-shop-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-shop-primary">
          Soon
        </span>
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${shell} border-shop-ink bg-shop-ink text-white hover:opacity-90`}
    >
      {inner}
    </a>
  );
}

/** The Apple mark. */
function AppleMark() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/** The Google Play mark, in its four brand colours. */
function PlayMark() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#00d3ff"
        d="M1.06.276C.427.593 0 1.222 0 2.019v19.962c0 .797.427 1.426 1.06 1.743L12.294 11.99 1.06.276z"
      />
      <path
        fill="#00f076"
        d="M2.847.443C2.51.242 2.148.145 1.803.157L13.3 11.583l3.522-3.5L2.847.443z"
      />
      <path
        fill="#ffd200"
        d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202c1.302.736 1.302 2.859 0 3.594z"
      />
      <path
        fill="#ff3a44"
        d="M1.803 23.842c.345.013.707-.084 1.044-.285l13.975-7.64-3.522-3.5L1.803 23.842z"
      />
    </svg>
  );
}
