import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import { discountPercent, formatPrice } from "@/lib/currency";
import { productPath } from "@/lib/seo";

/**
 * The middle of the homepage band, on the Taobao portal model.
 *
 * Two rows. The top one is two campaign banners — deals in brand yellow, new
 * arrivals in a pale blue — each fronted by a real product, beside a wide strip
 * of four products under the shop's strongest promise. The bottom one is four
 * small shelves of two products each, every one a link to the whole-catalogue
 * listing it previews.
 *
 * Kept light on purpose: white panels on a hairline, photos on a pale ground,
 * and the price as plain text UNDER the photo rather than a yellow sticker on
 * it. Twelve stickers and two solid yellow blocks made the band read dark and
 * busy; now the products carry it and colour is kept for the two banners.
 *
 * Every product comes from pools the homepage feed already fetched, so this
 * costs no request. `pick` hands out products so the same one does not appear
 * in two neighbouring cells while the catalogue is big enough to avoid it; on a
 * very small catalogue it falls back to repeats rather than empty cells.
 */

type Shelf = {
  key: string;
  title: string;
  tag: string;
  href: string;
  products: Product[];
};

export default function HeroMosaic({
  deals,
  newest,
  bestSellers,
}: {
  /** On-sale products, deepest saving first. */
  deals: Product[];
  /** The catalogue, newest first. */
  newest: Product[];
  /** Most units sold first. */
  bestSellers: Product[];
}) {
  const used = new Set<number>();
  const pick = (pool: Product[], count: number): Product[] => {
    const fresh = pool.filter((product) => !used.has(product.id));
    const chosen = [...fresh, ...pool.filter((product) => used.has(product.id))].slice(0, count);
    chosen.forEach((product) => used.add(product.id));
    return chosen;
  };

  const onSale = deals.length > 0 ? deals : newest.filter((product) => product.on_sale);
  const maxDiscount = Math.max(
    0,
    ...onSale.map((product) => discountPercent(product.regular_price, product.price))
  );
  const sellers = bestSellers.length > 0 ? bestSellers : newest;
  const rated = newest
    .filter((product) => product.rating_count > 0)
    .sort((a, b) => b.average_rating - a.average_rating);
  const cheapest = [...newest].sort((a, b) => a.price - b.price);

  const dealCover = pick(onSale.length > 0 ? onSale : newest, 1)[0];
  const newCover = pick(newest, 1)[0];
  const strip = pick(sellers, 4);

  const shelves: Shelf[] = [
    { key: "deals", title: "Super Deals", tag: "Hot", href: "/sale", products: pick(onSale.length > 0 ? onSale : newest, 2) },
    { key: "new", title: "New in", tag: "New", href: "/search?sort=newest", products: pick(newest, 2) },
    { key: "best", title: "Best sellers", tag: "Top", href: "/search?sort=popular", products: pick(sellers, 2) },
    rated.length >= 2
      ? { key: "rated", title: "Top rated", tag: "★ 4+", href: "/search?sort=rating", products: pick(rated, 2) }
      : { key: "cheap", title: "Lowest prices", tag: "Save", href: "/search?sort=price_asc", products: pick(cheapest, 2) },
  ];

  if (newest.length < 4) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
      {/* ---- Row 1: two banners and the promise strip ---- */}
      <HeroBanner
        href="/sale"
        tag="Hot deals"
        title="Super Deals"
        subtitle={maxDiscount > 0 ? `Up to ${maxDiscount}% off today` : "Today's best prices"}
        cta="Shop now"
        tone="yellow"
        cover={dealCover}
      />
      <HeroBanner
        href="/search?sort=newest"
        tag="New in"
        title="Just landed"
        subtitle="Fresh from Kandi sellers this week"
        cta="See what's new"
        tone="blue"
        cover={newCover}
      />

      <div className="col-span-2 flex flex-col rounded-2xl bg-white p-3 ring-1 ring-shop-edge">
        <PanelHeader href="/search?sort=popular" title="Pay on delivery" note="See it before you pay" />
        <ul className="grid flex-1 grid-cols-4 gap-2.5">
          {strip.map((product) => (
            <li key={product.id}>
              <PriceThumb product={product} />
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Row 2: four small shelves ---- */}
      {shelves.map((shelf) => (
        <div key={shelf.key} className="flex flex-col rounded-2xl bg-white p-3 ring-1 ring-shop-edge">
          <PanelHeader href={shelf.href} title={shelf.title} tag={shelf.tag} />
          <ul className="grid flex-1 grid-cols-2 gap-2.5">
            {shelf.products.map((product) => (
              <li key={product.id}>
                <PriceThumb product={product} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** A panel's title, an optional tag or note, and "See all" on the right. */
function PanelHeader({
  href,
  title,
  tag,
  note,
}: {
  href: string;
  title: string;
  tag?: string;
  note?: string;
}) {
  return (
    <Link href={href} prefetch className="group mb-2.5 flex items-center gap-1.5">
      <span className="truncate text-[15px] font-bold text-shop-ink">{title}</span>
      {tag && (
        <span className="shrink-0 rounded-full bg-[#fff4c2] px-1.5 text-[10px] font-semibold leading-[17px] text-[#7a5a00]">
          {tag}
        </span>
      )}
      {note && (
        <span className="hidden truncate text-[12px] text-shop-muted sm:inline">· {note}</span>
      )}
      <span className="ml-auto shrink-0 text-[12px] font-medium text-shop-muted group-hover:text-shop-ink">
        See all ›
      </span>
    </Link>
  );
}

/**
 * One of the two campaign banners. Both share this one layout — tag, title,
 * line, button, and a product on the right — so the pair reads as a set; only
 * the colours differ.
 */
function HeroBanner({
  href,
  tag,
  title,
  subtitle,
  cta,
  tone,
  cover,
}: {
  href: string;
  tag: string;
  title: string;
  subtitle: string;
  cta: string;
  tone: "yellow" | "blue";
  cover?: Product;
}) {
  const yellow = tone === "yellow";
  return (
    <Link
      href={href}
      prefetch
      className={`group relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl p-3.5 md:min-h-[168px] ${
        yellow
          ? "bg-gradient-to-br from-[#ffe066] to-[#ffcc00] text-[#111111]"
          : "bg-gradient-to-br from-[#eef4ff] to-[#dbe8ff] text-[#0f2a5c]"
      }`}
    >
      <span
        className={`relative z-10 w-fit rounded-full px-2 text-[10px] font-semibold uppercase leading-[18px] tracking-[0.04em] ${
          yellow ? "bg-white/70 text-[#7a5a00]" : "bg-white/80 text-[#1d4ed8]"
        }`}
      >
        {tag}
      </span>
      <span className="relative z-10 mt-2 max-w-[62%] text-[20px] font-extrabold leading-tight md:text-[22px]">
        {title}
      </span>
      <span
        className={`relative z-10 mt-1 max-w-[62%] text-[12.5px] leading-snug ${
          yellow ? "text-[#4a3b00]" : "text-[#33507f]"
        }`}
      >
        {subtitle}
      </span>
      <span
        className={`relative z-10 mt-auto inline-flex w-fit items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-transform group-hover:translate-x-0.5 ${
          yellow ? "bg-[#111111] text-white" : "bg-[#1d4ed8] text-white"
        }`}
      >
        {cta} <span aria-hidden>→</span>
      </span>
      {cover?.image && (
        <span className="absolute -right-3 bottom-2 h-[58%] w-[48%] overflow-hidden rounded-2xl bg-white shadow-[0_6px_18px_rgba(0,0,0,0.12)] md:h-[62%]">
          <Image
            src={cover.image}
            alt=""
            fill
            sizes="(max-width: 768px) 25vw, 140px"
            className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-[1.05]"
          />
        </span>
      )}
    </Link>
  );
}

/**
 * A square product photo on a pale ground, with its price as plain text
 * beneath — red when it is reduced — and the saving as a small chip on the
 * photo's corner.
 */
function PriceThumb({ product }: { product: Product }) {
  const discount = product.on_sale ? discountPercent(product.regular_price, product.price) : 0;
  return (
    <Link
      href={productPath(product)}
      aria-label={`${product.name}, ${formatPrice(product.price)}`}
      className="group block"
    >
      <span className="relative block aspect-square overflow-hidden rounded-xl bg-[#f6f6f7]">
        {product.image && (
          <Image
            src={product.image}
            alt=""
            fill
            sizes="(max-width: 768px) 40vw, 130px"
            className="object-contain p-1.5 mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.05]"
          />
        )}
        {discount >= 5 && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-[#e2231a] px-1 text-[10px] font-semibold leading-[16px] text-white">
            -{discount}%
          </span>
        )}
      </span>
      <span
        className={`mt-1.5 block truncate text-[13px] font-bold leading-tight ${
          discount > 0 ? "text-[#e2231a]" : "text-shop-ink"
        }`}
      >
        {formatPrice(product.price)}
      </span>
    </Link>
  );
}
