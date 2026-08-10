import Link from "next/link";

/**
 * The long banner that introduces the endless grid.
 *
 * Short and wide — a strip, not a hero. It sits between two product sections,
 * so anything taller would push the grid it is announcing off the screen. One
 * line of type, one link, a flat orange ground.
 */
export default function WideBanner({
  eyebrow,
  headline,
  href,
  cta = "Shop now",
}: {
  eyebrow?: string;
  headline: string;
  href: string;
  cta?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-wrap items-center justify-between gap-4 rounded-xl bg-shop-primary px-6 py-6 text-white md:px-10"
    >
      <div>
        {eyebrow && (
          <p className="text-[12px] uppercase tracking-[0.14em] text-white/80">{eyebrow}</p>
        )}
        <p className="font-heading mt-1 text-[17px] leading-tight md:text-[21px]">{headline}</p>
      </div>

      <span className="flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-[14px] font-semibold text-shop-ink transition-transform group-hover:translate-x-0.5">
        {cta}
        <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
