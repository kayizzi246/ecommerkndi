import Link from "next/link";
import Image from "next/image";

export default function BlackFridayHero() {
  return (
    <section className="black-friday-hero" aria-labelledby="black-friday-title">
      <Image src="/images/black-friday-kandi.webp" alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="black-friday-copy">
        <p className="black-friday-eyebrow">KANDI &middot; EARLY BLACK FRIDAY</p>
        <h2 id="black-friday-title">Big finds.<br /><span>Better prices.</span></h2>
        <p>Discover deals across your favourite categories.</p>
        <div className="black-friday-actions">
          <Link href="/sale" className="black-friday-cta">Shop deals <span aria-hidden>&rarr;</span></Link>
          <a href="#all-products" className="black-friday-browse">Browse all products &rarr;</a>
        </div>
      </div>
    </section>
  );
}
