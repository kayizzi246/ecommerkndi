import Link from "next/link";

/**
 * The heading every homepage section wears.
 *
 * One component so the sections cannot drift apart — the page previously had
 * four heading treatments in four sections, which is what made it read as a
 * template rather than a marketplace.
 *
 * Sizes are deliberately restrained. A section heading is a signpost; on a page
 * whose job is showing products it should not be the largest thing on screen.
 */
export default function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = "View All",
  id,
  children,
  /**
   * Which ground this heading sits on.
   *
   * A section with a dark band behind it cannot use the default — the title
   * is `text-shop-ink` and would be invisible on it. The alternative was for
   * that section to hand-roll its own `<h2>`, which is precisely what this
   * component exists to stop: the page carried four heading treatments before
   * it, and a fifth added "because that one is on a dark background" is how it
   * gets back to four.
   *
   * The link keeps the brand orange in BOTH tones, deliberately. #ff6a00 is
   * 5.9:1 on #111827 — the same arithmetic the masthead note in `Header` runs
   * — so it is one of the few things in this shop that needs no adjustment
   * when the ground flips.
   */
  tone = "light",
}: {
  tone?: "light" | "dark";
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  /**
   * The heading's DOM id, for the wrapping section's `aria-labelledby`.
   *
   * Every homepage section pointed `aria-labelledby` at an id like
   * `super-deals-heading` that nothing rendered, because this component never
   * put one on the `<h2>`. A dangling reference leaves the section unlabelled
   * to a screen reader — worse than no attribute, since it reads as a region
   * with no name at all.
   */
  id?: string;
  /** Anything that belongs beside the title — a countdown, a badge. */
  children?: React.ReactNode;
}) {
  // No horizontal padding of its own any more. The rails used to run to the
  // edge of a phone screen and this held the heading off the glass; the page
  // itself carries a 12px gutter now (see `app/page.tsx`), so keeping this
  // would set every section title 12px in from a grid that starts at 0 —
  // a heading that does not line up with the products it names.
  //
  // `mb-3` — 12px, down from 14 — is the within-section half of the spacing
  // ratio the homepage depends on. The gap BETWEEN sections came down from 48px
  // to 32, and this came down with it so that a heading still sits far nearer
  // its own products than it does the rail above. The reasoning in full is at
  // the head of the section list in `app/page.tsx`; the short version is that
  // both numbers move together or neither does.
  return (
    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          {/* `heading-black` carries the weight: the global heading rule sets
              600, and these two anchor the page. */}
          {/* 22/26, up from 18/20. With the tinted bands gone from the
              department rails, the heading is now the ONLY thing separating one
              section of the homepage from the next, and at 18px it was sized
              for a page where a coloured ground was doing half that work. Outfit
              is also a wider, rounder face than the one this was set for, so it
              carries the extra size without the line looking heavy. */}
          <h2
            id={id}
            className={`heading-black text-[22px] md:text-[26px] ${
              tone === "dark" ? "text-white" : "text-shop-ink"
            }`}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={`section-sub mt-0.5 text-[13.5px] ${
                tone === "dark" ? "text-white/60" : ""
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>

      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-shop-primary transition-colors hover:text-shop-primary-dark"
        >
          {linkLabel}
          <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
