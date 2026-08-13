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
}: {
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
  // The rails below run to the edge of a phone screen; text must not. This
  // padding is the header's own, so a section heading keeps a thumb's width of
  // margin while the products beside it use the full width.
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 md:px-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          {/* `heading-black` carries the weight: the global heading rule sets
              600, and these two anchor the page. */}
          <h2 id={id} className="heading-black text-[18px] text-shop-ink md:text-[20px]">
            {title}
          </h2>
          {subtitle && <p className="section-sub mt-0.5 text-[13.5px]">{subtitle}</p>}
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
