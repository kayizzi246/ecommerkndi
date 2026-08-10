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
        <h1 className="text-[21px] font-extrabold leading-tight text-shop-ink md:text-[19px]">
          {title}
        </h1>
        {intro && (
          <p className="mt-3 max-w-[65ch] text-[17px] leading-relaxed text-shop-body">{intro}</p>
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
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
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
