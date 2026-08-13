import Link from "next/link";

/**
 * Shared shell for the informational pages (about, help, policies…).
 *
 * One layout for all of them keeps the reading measure, the heading scale and
 * the breadcrumb consistent, and means a new policy page is a content file
 * rather than a fresh design.
 */
export default function InfoPage({
  title,
  intro,
  eyebrow,
  children,
}: {
  title: string;
  intro?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[900px] px-4 pb-24 pt-6 md:px-8 lg:pb-16">
      <nav className="mb-6 flex items-center gap-2 text-[13px] text-shop-muted">
        <Link href="/" className="hover:text-shop-primary">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="text-shop-ink">{title}</span>
      </nav>

      <header className="border-b border-shop-line pb-6">
        {eyebrow && (
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-shop-primary">
            {eyebrow}
          </p>
        )}
        {/* The desktop step used to be `md:text-[19px]` — *smaller* than the
            21px it renders at on a phone. A page title that shrinks as the
            screen grows is backwards, and it left every policy and help page
            with a heading barely distinguishable from the body copy under it on
            the screens where there was most room for one. It now steps up. */}
        <h1 className="heading-800 text-[24px] text-shop-ink md:text-[30px]">
          {title}
        </h1>
        {intro && (
          // The lede. 500 rather than 400: this is the paragraph that has to be
          // read for the page to have worked, and at the body weight it was
          // indistinguishable from the sections below it.
          <p className="mt-3 max-w-[65ch] text-[17px] font-medium leading-relaxed text-shop-body">
            {intro}
          </p>
        )}
      </header>

      <div className="mt-8 space-y-8">{children}</div>
    </main>
  );
}

/** A titled block of copy. Keeps every policy page on the same rhythm. */
export function InfoSection({
  title,
  children,
  /** Anchor target, for sections other pages link straight to. */
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    // `scroll-mt` clears the sticky masthead — without it an anchored section
    // lands underneath the header and reads as the wrong section entirely.
    <section id={id} className={id ? "scroll-mt-32" : undefined}>
      <h2 className="text-[20px] font-extrabold text-shop-ink">{title}</h2>
      <div className="mt-2.5 max-w-[70ch] space-y-3 text-[16px] leading-relaxed text-shop-body [&_a]:font-semibold [&_a]:text-shop-primary [&_a:hover]:underline [&_li]:my-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

/** Closing call to action, so no page is a dead end. */
export function InfoFooterCta({
  text,
  href,
  label,
}: {
  text: string;
  href: string;
  label: string;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-shop-line bg-white p-6">
      <p className="text-[16px] font-semibold text-shop-ink">{text}</p>
      <Link href={href} className="btn-shop px-7 py-3 text-[15px]">
        {label}
      </Link>
    </div>
  );
}
