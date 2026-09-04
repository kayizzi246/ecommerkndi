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
   * A section with a dark band behind it cannot use the default — the title is
   * `text-shop-ink` and would be invisible on it. The alternative is for that
   * section to hand-roll its own `<h2>`, which is precisely what this component
   * exists to stop: the page carried four heading treatments before it, and a
   * fifth added "because that one is on a dark background" is how it gets back
   * to four.
   *
   * The link keeps the brand orange in BOTH tones, deliberately. #ff6a00 is
   * 5.9:1 on #111827 — the same arithmetic the masthead note in `Header` runs —
   * so it is one of the few things in this shop that needs no adjustment when
   * the ground flips.
   *
   * ---- Added, removed, added again ----
   *
   * Recorded because the churn is the useful part. It went in for the Super
   * Deals ink shelf, came out when that shelf was reverted to white, and is
   * back now the shelf is dark for good. The lesson is not about this prop: it
   * is that a shelf's GROUND and the readability of the tiles standing on it
   * are one decision, and the first two attempts changed the ground without
   * changing what stands on it.
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
    /* `section-head` is what the coloured shelves hang their bar on — see
       the accent-shelf block in globals.css. It carries no styling of its own. */
    <div className="section-head mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {/* `min-w-0 flex-1`, so the "View All" link beside this keeps the first
          line to itself.

          Without it this group is sized by its content, and on a 390px phone
          the Super Deals header — a title, a subtitle and a countdown chip —
          filled the line on its own and pushed the link onto a second row,
          where it sat orphaned and left-aligned under the heading it belongs
          to. Letting the group take the remaining width instead means anything
          that does not fit wraps INSIDE it, under the title, and the link stays
          where a shopper looks for it: the far end of the heading row. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          {/* `heading-black` carries the weight: the global heading rule sets
              600, and these two anchor the page. */}
          {/* 22/26, up from 18/20. With the tinted bands gone from the
              department rails, the heading is now the ONLY thing separating one
              section of the homepage from the next, and at 18px it was sized
              for a page where a coloured ground was doing half that work. Outfit
              is also a wider, rounder face than the one this was set for, so it
              carries the extra size without the line looking heavy. */}
          {/* ---- 20/24, down from 22/26 ----

              The bigger pair was set when the heading was the ONLY thing
              separating one section of the homepage from the next — the tinted
              bands had just been removed from the department rails, and the
              note here said so explicitly. A title carrying a section boundary
              on its own has to be loud enough to be that boundary.

              It is not carrying it any more. Every section is a panel with its
              own edge now, so the break between shelves is drawn rather than
              implied, and a 26px title inside a bounded panel is a heading
              competing with the boundary that already did its job. Two steps
              down puts it back to being a signpost over its own merchandise —
              which is what the paragraph at the top of this file says a section
              heading is for.

              This is the same trade the whole redesign makes: structure takes
              over the work that size and colour were doing, and the type gets
              quieter as a result. */}
          <h2
            id={id}
            className={`heading-black text-[20px] md:text-[24px] ${
              tone === "dark" ? "text-white" : "text-shop-ink"
            }`}
          >
            {title}
          </h2>
          {/* ---- `!text-white/75`, and the `!` is load-bearing ----

              This was `text-white/60` with no `!`, and on the crimson deals
              shelf it did nothing at all: `.section-sub` in globals.css sets
              `color: var(--color-shop-body)`, both are single-class selectors,
              and the stylesheet wins on order. So the subtitle rendered in the
              light-ground grey on a saturated red — about 1.6:1, effectively
              invisible — while the class list claimed otherwise.

              Raised to 75% at the same time. 60% white on #b8123a is 4.0:1 and
              fails AA for body-sized text; 75% clears it. The old value was
              chosen against #111827, where 60% is comfortable — a reminder that
              a tone called "dark" is not one colour and its contrast has to be
              rechecked whenever the ground it names changes. */}
          {subtitle && (
            <p
              className={`section-sub mt-0.5 text-[13px] ${
                tone === "dark" ? "!text-white/75" : ""
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
          /* ---- The link is white on a dark ground, not orange ----

             The note at the top of this file says the brand orange needs no
             adjustment when the ground flips, because #ff6a00 is 5.9:1 on
             #111827. That was true and it was true about ONE dark ground. The
             deals shelf is crimson now, and orange on #b8123a is about 2:1 —
             two saturated warm hues a few degrees apart, which is both
             unreadable and the exact colour clash the palette note warns
             against.

             White is the only safe answer on a ground the shelf is free to
             change: it is 7.4:1 here and it cannot fail on any dark ground the
             shop might pick next. The hover drops to 80% rather than shifting
             hue, since there is no darker white to move to. */
          className={`flex shrink-0 items-center gap-1 text-[13px] font-semibold transition-colors ${
            tone === "dark"
              ? "text-white hover:text-white/80"
              : "text-shop-primary hover:text-shop-primary-dark"
          }`}
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
