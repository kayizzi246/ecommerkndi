import Link from "next/link";
import Image from "next/image";

/**
 * The Black November banner at the top of the homepage: the campaign photo
 * and a live offer over the gift-coloured artwork.
 */
export default function BlackFridayHero() {
  return (
    <section className="hx-hero hx-hero-gifts" aria-labelledby="hx-hero-title">
      <Image
        src="/images/kandi-gift-sale.webp"
        alt=""
        fill
        preload
        sizes="(max-width: 1720px) 100vw, 1720px"
        className="hx-hero-image object-cover"
      />
      <div className="hx-hero-shade" aria-hidden />
      <div className="hx-hero-copy">
        <p className="hx-hero-eyebrow">
          Black November deals
        </p>
        <h2 id="hx-hero-title" className="hx-hero-title">
          <span className="hx-hero-upto">Up to</span>
          <span className="hx-hero-big">70%</span>
          <span className="hx-hero-off">off</span>
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
