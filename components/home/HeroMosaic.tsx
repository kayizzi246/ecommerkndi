import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import { discountPercent, formatPrice } from "@/lib/currency";
import { productPath } from "@/lib/seo";

/**
 * The middle of the homepage band, on the Taobao portal model.
 *
 * Two rows. The top one is two campaign banners — deals in solid orange, new
 * arrivals in warm beige — beside a wide strip of four products under the
 * shop's strongest promise. The bottom one is four small shelves of two
 * products each, every one a link to the whole-catalogue listing it previews.
 *
 * Every product comes from pools the homepage feed already fetched, so this
 * costs no request. `pick` hands out products so the same one does not appear
 * in two neighbouring cells while the catalogue is big enough to avoid it; on a
 * very small catalogue it falls back to repeats rather than empty cells.
 */

/** The hero's accent: a strong, flat orange, used for banners, tags and chips. */
const ORANGE = "#ff5000";

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
        tag="Hot"
        title="Super Deals"
        subtitle={maxDiscount > 0 ? `Up to ${maxDiscount}% off today` : "Today's best prices"}
        cta="Shop now →"
        tone="orange"
      />
      <HeroBanner
        href="/search?sort=newest"
        tag="New in"
        title="Just landed this week"
        subtitle="Fresh from Kandi sellers"
        cta="See what's new →"
        tone="beige"
      />

      <div className="col-span-2 flex flex-col rounded-2xl bg-shop-surface p-3">
        <Link href="/search?sort=popular" className="mb-2 block truncate text-[14px] font-bold text-shop-ink hover:text-[#ff5000]">
          Pay on delivery — see it before you pay
        </Link>
        <ul className="grid flex-1 grid-cols-4 gap-2">
          {strip.map((product) => (
            <li key={product.id}>
              <PriceThumb product={product} />
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Row 2: four small shelves ---- */}
      {shelves.map((shelf) => (
        <div key={shelf.key} className="flex flex-col rounded-2xl bg-shop-surface p-3">
          <Link href={shelf.href} className="mb-2 flex items-center gap-1.5">
            <span className="truncate text-[14px] font-bold text-shop-ink">{shelf.title}</span>
            <span className="shrink-0 rounded-[4px] px-1 text-[10px] font-bold leading-[16px] text-white" style={{ background: ORANGE }}>
              {shelf.tag}
            </span>
          </Link>
          <ul className="grid flex-1 grid-cols-2 gap-2">
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

/**
 * One of the two campaign banners. Both share this one layout — tag, title,
 * line, button, all at the same sizes — so the pair reads as a set; only the
 * colours differ.
 */
function HeroBanner({
  href,
  tag,
  title,
  subtitle,
  cta,
  tone,
}: {
  href: string;
  tag: string;
  title: string;
  subtitle: string;
  cta: string;
  tone: "orange" | "beige";
}) {
  const orange = tone === "orange";
  return (
    <Link
      href={href}
      className={`flex min-h-[150px] flex-col rounded-2xl p-3.5 transition-[filter] hover:brightness-[1.03] md:min-h-[168px] ${
        orange ? "text-white" : "bg-[#fbe6cf] text-[#2a1a0f]"
      }`}
      style={orange ? { background: ORANGE } : undefined}
    >
      <span
        className="w-fit rounded-[4px] px-1.5 text-[10px] font-bold uppercase leading-[16px]"
        style={orange ? { background: "#fff", color: ORANGE } : { background: ORANGE, color: "#fff" }}
      >
        {tag}
      </span>
      <span className="mt-1.5 text-[18px] font-extrabold leading-tight md:text-[20px]">{title}</span>
      <span className={`mt-1 text-[13px] font-semibold leading-snug ${orange ? "text-white/90" : "text-[#6b5444]"}`}>
        {subtitle}
      </span>
      <span
        className="mt-auto inline-flex w-fit rounded-full px-3 py-1 text-[12px] font-bold"
        style={orange ? { background: "#fff", color: ORANGE } : { background: ORANGE, color: "#fff" }}
      >
        {cta}
      </span>
    </Link>
  );
}

/** A square product photo with its price on an orange tag across the foot. */
function PriceThumb({ product }: { product: Product }) {
  return (
    <Link
      href={productPath(product)}
      aria-label={`${product.name} — ${formatPrice(product.price)}`}
      className="group relative block aspect-square overflow-hidden rounded-xl bg-white"
    >
      {product.image && (
        <Image
          src={product.image}
          alt=""
          fill
          sizes="(max-width: 768px) 40vw, 130px"
          className="object-contain p-1 transition-transform duration-300 group-hover:scale-[1.04]"
        />
      )}
      <span
        className="absolute bottom-1.5 left-1/2 max-w-[92%] -translate-x-1/2 truncate whitespace-nowrap rounded-md px-1.5 py-px text-[11px] font-bold text-white md:text-[12px]"
        style={{ background: ORANGE }}
      >
        {formatPrice(product.price)}
      </span>
    </Link>
  );
}
