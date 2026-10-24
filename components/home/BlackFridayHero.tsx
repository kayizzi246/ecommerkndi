import Link from "next/link";
import Image from "next/image";

/**
 * The campaign banner at the top of the homepage.
 *
 * Compact on purpose: it was a 330px stage with the headline centred over it,
 * which on a laptop pushed every product below the fold. At ~240px with the
 * copy ranged left, the deals and the first products are visible on arrival.
 */
export default function BlackFridayHero({ maxDiscount }: { maxDiscount: number }) {
  const headline = maxDiscount >= 10 ? `Up to ${maxDiscount}% off` : "Up to 70% off";
  return (
    <section className="hx-hero" aria-labelledby="hx-hero-title">
      <Image
        src="/images/black-friday-kandi.webp"
        alt=""
        fill
        priority
        sizes="(max-width: 1720px) 100vw, 1720px"
        className="object-cover"
      />
      <div className="hx-hero-shade" aria-hidden />
      <div className="hx-hero-copy">
        <p className="hx-hero-eyebrow">Black November deals</p>
        <h2 id="hx-hero-title" className="hx-hero-title">
          {headline}
        </h2>
        <p className="hx-hero-sub">Shoes, fashion and home essentials. Delivered across Uganda.</p>
        <div className="hx-hero-actions">
          <Link href="/sale" className="hx-btn hx-btn-primary">
            Shop deals
          </Link>
          <a href="#all-products" className="hx-btn hx-btn-ghost">
            Browse all
          </a>
        </div>
      </div>
    </section>
  );
}
