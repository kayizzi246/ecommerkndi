import Link from "next/link";

/**
 * The long banner that introduces the endless grid.
 *
 * Short and wide — a strip, not a hero. It sits between two product sections,
 * so anything taller would push the grid it is announcing off the screen.
 *
 * It carries three things and stops: the offer (from wp-admin, so the shop can
 * change it without a deploy), the reasons not to hesitate, and one button. The
 * reasons are the shop's real terms rather than adjectives — a shopper deciding
 * whether to buy from an online store in Uganda is weighing the risk of paying
 * for something that never arrives, and "pay on delivery" answers that where
 * "amazing offers" does not.
 */
export default function WideBanner({
  eyebrow,
  headline,
  href,
  cta = "Shop now",
  /** Short trust/urgency lines printed under the headline. */
  reasons = [],
}: {
  eyebrow?: string;
  headline: string;
  href: string;
  cta?: string;
  reasons?: string[];
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-xl bg-gradient-to-r from-shop-ember via-shop-primary to-shop-primary px-6 py-7 text-white md:px-10"
    >
      {/* A soft light behind the type, so the slab is not a flat rectangle of
          orange. Decorative, pointer-events-free, and cheap — a CSS gradient
          rather than an image request in the middle of the page. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/15 blur-2xl"
      />

      <div className="relative min-w-0">
        {eyebrow && (
          <p className="inline-block rounded-full bg-black/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
            {eyebrow}
          </p>
        )}
        <p className="font-heading mt-2 text-[22px] leading-tight md:text-[30px]">{headline}</p>

        {reasons.length > 0 && (
          <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/90">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-center gap-1.5">
                <svg aria-hidden className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
                {reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      <span className="relative flex shrink-0 items-center gap-2 rounded-lg bg-white px-7 py-3 text-[15px] font-bold text-shop-ink shadow-sm transition-transform group-hover:translate-x-0.5">
        {cta}
        <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
