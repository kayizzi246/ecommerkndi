import Link from "next/link";
import Image from "next/image";

/** Positions and timings for the floating gold sparkles, fixed so server and browser agree. */
const SPARKS = [
  { left: "8%", top: "70%", delay: "0s", size: 6 },
  { left: "18%", top: "25%", delay: "1.2s", size: 4 },
  { left: "30%", top: "80%", delay: "2.4s", size: 5 },
  { left: "70%", top: "75%", delay: "0.6s", size: 5 },
  { left: "82%", top: "30%", delay: "1.8s", size: 7 },
  { left: "91%", top: "65%", delay: "3s", size: 4 },
  { left: "50%", top: "12%", delay: "2.1s", size: 4 },
  { left: "60%", top: "88%", delay: "0.9s", size: 6 },
];

/**
 * The Black November banner at the top of the homepage: centred headline,
 * "UP TO 70% OFF" with a gold shimmer, and gold sparkles
 * drifting up over the photo. The movement is all CSS (app/motion.css) and
 * stops for shoppers who have asked their device for reduced motion.
 */
export default function BlackFridayHero() {
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
      <div className="hx-sparks" aria-hidden>
        {SPARKS.map((spark, index) => (
          <span
            key={index}
            className="hx-spark"
            style={{
              left: spark.left,
              top: spark.top,
              width: spark.size,
              height: spark.size,
              animationDelay: spark.delay,
            }}
          />
        ))}
      </div>
      <div className="hx-hero-copy">
        <p className="hx-hero-eyebrow">
          <span className="hx-live" aria-hidden />
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
