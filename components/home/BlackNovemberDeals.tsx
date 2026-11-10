import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import { discountPercent, formatPrice, hasPriceReduction } from "@/lib/currency";
import { productPath } from "@/lib/seo";
import DealsTrack from "@/components/home/DealsTrack";
import DealsCountdown from "@/components/home/DealsCountdown";

/**
 * The homepage's Black November deals: the deepest real discounts in the shop,
 * as one even grid of product tiles on a flat black band.
 *
 * Built like a marketplace deals shelf rather than a landing page: the
 * photograph, the discount and the price do the selling, the whole tile is the
 * link, and there is no button repeated under every product, no badge
 * restating the heading and no glow behind it. Every price is the product's
 * own sale price against its own regular price.
 */
export default function BlackNovemberDeals({
  products,
  returnsDays,
  upTo,
}: {
  products: Product[];
  returnsDays: number;
  /** The deepest discount in the shop, when it is shown elsewhere on the page and not in this row. */
  upTo?: number;
}) {
  // One of each product: imports often list the same item twice under
  // slightly different titles, and two identical tiles side by side look fake.
  const deals = products
    .filter((product) => hasPriceReduction(product.regular_price, product.price))
    .filter((product, index, all) => all.findIndex((other) => nameKey(other.name) === nameKey(product.name)) === index)
    .sort(
      (a, b) =>
        discountPercent(b.regular_price, b.price) - discountPercent(a.regular_price, a.price)
    )
    .slice(0, 20);
  if (deals.length < 6) return null;

  const deepest = Math.max(upTo ?? 0, discountPercent(deals[0].regular_price, deals[0].price));

  return (
    <section className="bnd" aria-labelledby="bnd-title">
      <div className="bnd-head">
        <h2 id="bnd-title" className="bnd-title">
          Black November <span className="bnd-upto">up to {deepest}% off</span>
        </h2>
        <DealsCountdown />
        <Link href="/sale" className="bnd-all">
          See all
          <svg aria-hidden viewBox="0 0 20 20" fill="currentColor">
            <path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4Z" />
          </svg>
        </Link>
      </div>

      <DealsTrack>
        {deals.map((product, index) => (
          <li key={product.id}>
            <Link href={productPath(product)} className="bnd-tile">
              <span className="bnd-photo">
                {product.image && (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    // The tile is ~270px wide on a desktop; a smaller hint
                    // made the browser fetch a 192px file and stretch it.
                    sizes="(max-width: 639px) 40vw, (max-width: 1023px) 25vw, 300px"
                    quality={90}
                    className="object-cover"
                    priority={index < 3}
                  />
                )}
                <span className="bnd-off">-{discountPercent(product.regular_price, product.price)}%</span>
              </span>
              <span className="bnd-info">
                <span className="bnd-name">{product.name}</span>
                <span className="bnd-prices">
                  <span className="price bnd-price">{formatPrice(product.price)}</span>
                  <s className="bnd-was">{formatPrice(product.regular_price)}</s>
                </span>
                <span className="bnd-meta">
                  {product.total_sales > 0
                    ? `${compact(product.total_sales)} sold`
                    : `Save ${formatPrice(product.regular_price - product.price)}`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </DealsTrack>

      <p className="bnd-trust">
        <span>Pay on delivery in Kampala</span>
        <span>{returnsDays}-day returns</span>
        <span>Rider calls before delivery</span>
      </p>
    </section>
  );
}

/** 1234 → "1.2K". */
function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

/** The first few words of a title, lower-cased: enough to spot one product imported twice. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).slice(0, 5).join(" ");
}
