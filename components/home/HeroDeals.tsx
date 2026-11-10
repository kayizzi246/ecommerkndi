import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import { discountPercent, formatPrice } from "@/lib/currency";
import { productPath } from "@/lib/seo";

/**
 * The panel beside the campaign banner on a desktop: the four deepest real
 * discounts in the shop, so the first screen shows prices, not only a slogan.
 * Hidden on phones, where the deals row sits right under the banner instead.
 */
export default function HeroDeals({ products }: { products: Product[] }) {
  if (products.length < 4) return null;

  return (
    <aside className="hx-side" aria-labelledby="hx-side-title">
      <div className="hx-side-head">
        <h2 id="hx-side-title">Top deals today</h2>
        <Link href="/sale">See all ›</Link>
      </div>
      <ul className="hx-side-grid">
        {products.slice(0, 4).map((product) => (
          <li key={product.id}>
            <Link
              href={productPath(product)}
              className="hx-side-tile"
              aria-label={`${product.name}, ${formatPrice(product.price)}`}
            >
              <span className="hx-side-photo">
                {product.image && <Image src={product.image} alt="" fill sizes="170px" className="object-cover" />}
                <span className="hx-side-off">-{discountPercent(product.regular_price, product.price)}%</span>
              </span>
              <span className="price hx-side-price">{formatPrice(product.price)}</span>
              <s className="original-price hx-side-was">{formatPrice(product.regular_price)}</s>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
