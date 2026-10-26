import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import { discountPercent, formatPrice, hasPriceReduction } from "@/lib/currency";
import { productPath } from "@/lib/seo";

/**
 * The homepage's Black November section: the two deepest real discounts in
 * the shop as large cards (Deal of the Day first), the next best beside them, and the
 * guarantees that make a stranger willing to pay — all on the campaign's
 * black and gold.
 *
 * It replaced the "Lightning deals" strip, whose clock counted to midnight
 * and restarted every day. A deadline that never arrives is the quickest way
 * to teach shoppers to distrust every other claim on the page, so this
 * section sells on the numbers instead: every deal shows the original price
 * and the saving in shillings, worked out from the product's own prices.
 */
export default function BlackNovemberDeals({
  products,
  returnsDays,
}: {
  products: Product[];
  returnsDays: number;
}) {
  // One of each product: imports often list the same item twice under
  // slightly different titles, and two identical cards side by side look fake.
  const deals = products
    .filter((product) => hasPriceReduction(product.regular_price, product.price))
    .filter((product, index, all) => all.findIndex((other) => nameKey(other.name) === nameKey(product.name)) === index)
    .sort(
      (a, b) =>
        discountPercent(b.regular_price, b.price) - discountPercent(a.regular_price, a.price)
    );
  if (deals.length < 6) return null;

  const heroes = deals.slice(0, 6);
  const grid = deals.slice(6, 14);

  return (
    <section className="bnd" aria-labelledby="bnd-title">
      <div className="bnd-head">
        <div>
          <p className="hx-hero-eyebrow">
            Black November
          </p>
          <h2 id="bnd-title" className="bnd-title">
            Black November Deals
          </h2>
          <p className="bnd-sub">Real reductions. The original price is shown on every deal.</p>
        </div>
        <Link href="/sale" className="bnd-all">
          See all deals ›
        </Link>
      </div>

      <div className="bnd-body">
        {/* ---- The six deepest cuts, large, the first marked Deal of the day ---- */}
        <div className="bnd-heroes">
          {heroes.map((hero, index) => (
            <Link key={hero.id} href={productPath(hero)} target="_blank" rel="noopener" className="bnd-hero">
              <span className="bnd-hero-photo">
                {hero.image && (
                  <Image
                    src={hero.image}
                    alt={hero.name}
                    fill
                    sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 240px"
                    className="object-cover"
                  />
                )}
                <span className="bnd-hero-off">-{discountPercent(hero.regular_price, hero.price)}%</span>
              </span>
              <span className="bnd-hero-info">
                {index === 0 && <span className="bnd-hero-badge">Deal of the day</span>}
                <span className="bnd-hero-name">{hero.name}</span>
                <span className="bnd-hero-prices">
                  <span className="price bnd-hero-price">{formatPrice(hero.price)}</span>
                  <s className="bnd-hero-was">{formatPrice(hero.regular_price)}</s>
                </span>
                <span className="bnd-hero-save">You save {formatPrice(hero.regular_price - hero.price)}</span>
                <span className="bnd-hero-cta">View deal</span>
              </span>
            </Link>
          ))}
        </div>

        {/* ---- The next best deals ---- */}
        <ul className="bnd-grid">
          {grid.map((product) => (
            <li key={product.id}>
              <Link href={productPath(product)} target="_blank" rel="noopener" className="bnd-tile">
                <span className="bnd-tile-photo">
                  {product.image && (
                    <Image
                      src={product.image}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 44vw, 180px"
                      className="object-cover"
                    />
                  )}
                  <span className="bnd-tile-off">-{discountPercent(product.regular_price, product.price)}%</span>
                </span>
                <span className="price bnd-tile-price">{formatPrice(product.price)}</span>
                <s className="bnd-tile-was">{formatPrice(product.regular_price)}</s>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Why it is safe to buy ---- */}
      <ul className="bnd-trust">
        <li>
          <TrustIcon d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          Original price on every deal
        </li>
        <li>
          <TrustIcon d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
          Pay on delivery in Kampala
        </li>
        <li>
          <TrustIcon d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
          {returnsDays}-day returns
        </li>
        <li>
          <TrustIcon d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.125 1.125 0 0 0-1.173.417l-.97 1.293a12.035 12.035 0 0 1-7.143-7.143l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          Rider calls before delivery
        </li>
      </ul>
    </section>
  );
}

function TrustIcon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

/** The first few words of a title, lower-cased: enough to spot one product imported twice. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).slice(0, 5).join(" ");
}
