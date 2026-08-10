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
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  /** Anything that belongs beside the title — a countdown, a badge. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          {/* `heading-black` carries the weight: the global heading rule sets
              600, and these two anchor the page. */}
          <h2 className="heading-black text-[22px] text-shop-ink md:text-[26px]">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[13.5px] text-shop-muted">{subtitle}</p>}
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
