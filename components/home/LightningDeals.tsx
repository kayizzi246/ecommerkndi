import Image from "next/image";
import Link from "next/link";
import CountdownBlocks from "@/components/home/CountdownBlocks";
import type { Product } from "@/lib/woocommerce";
import { discountPercent, formatPrice, hasPriceReduction } from "@/lib/currency";
import { productPath } from "@/lib/seo";

/**
 * Temu's "Lightning deals" strip: the deepest cuts as photographs with their
 * prices, under a bar that says how long today's prices last.
 *
 * This replaced the two banners that held only a headline and an empty box —
 * a deals panel with no deals in it — so the first thing under the campaign
 * is now the merchandise itself.
 */
export default function LightningDeals({ products }: { products: Product[] }) {
  if (products.length < 4) return null;
  return (
    <section className="hx-panel hx-deals" aria-labelledby="hx-deals-title">
      <div className="hx-deals-bar">
        <h2 id="hx-deals-title" className="hx-deals-title">
          <svg aria-hidden className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
          </svg>
          Lightning deals
        </h2>
        <span className="hx-deals-timer">
          <span className="hidden sm:inline">Ends in</span>
          <CountdownBlocks />
        </span>
        <Link href="/sale" className="hx-deals-all">
          See all ›
        </Link>
      </div>
      <ul className="hx-deals-row no-scrollbar">
        {products.map((product) => (
          <li key={product.id}>
            <DealTile product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DealTile({ product }: { product: Product }) {
  const discount = discountPercent(product.regular_price, product.price);
  const reduced = hasPriceReduction(product.regular_price, product.price);
  return (
    <Link
      href={productPath(product)}
      className="hx-deal"
      aria-label={`${product.name}, ${formatPrice(product.price)}`}
    >
      <span className="hx-deal-photo">
        {product.image && (
          <Image src={product.image} alt="" fill sizes="(max-width: 640px) 36vw, 180px" className="object-cover" />
        )}
        {discount > 0 && <span className="hx-deal-off">-{discount}%</span>}
      </span>
      <span className="hx-deal-price">{formatPrice(product.price)}</span>
      {reduced ? (
        <s className="hx-deal-was">{formatPrice(product.regular_price)}</s>
      ) : (
        <span className="hx-deal-was">&nbsp;</span>
      )}
    </Link>
  );
}
