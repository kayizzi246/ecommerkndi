import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/woocommerce";
import { formatPrice, discountPercent } from "@/lib/currency";
import WishlistButton from "@/components/WishlistButton";
import TileCartButton from "@/components/TileCartButton";

/** At or below this many units, the card says how few are left. */
const LOW_STOCK_AT = 5;

/** A product counts as new for this long after it was created. */
const NEW_WINDOW_DAYS = 30;

function isNew(product: Product): boolean {
  if (!product.date_created) return false;
  return Date.now() - new Date(product.date_created).getTime() < NEW_WINDOW_DAYS * 86_400_000;
}

/** "2.2K sold" — the compact form marketplaces print beside a price. */
function compactSold(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

/**
 * Five dark stars, filled to the rating.
 *
 * Dark rather than gold: on a card this dense the stars are a measurement, not
 * a decoration, and a row of gold pulls the eye off the price sitting directly
 * above it. Half-steps are rounded to the nearest whole star — at 11px a half
 * star is indistinguishable from a full one anyway.
 */
function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating);

  return (
    <span className="flex items-center gap-[1px]" aria-label={`Rated ${rating.toFixed(1)} of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          aria-hidden
          className={`h-[11px] w-[11px] ${index < filled ? "text-shop-ink" : "text-shop-line"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5Z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * The one product card the whole store uses — every grid, rail and carousel.
 *
 * Chrome-free: no border, no shadow, no card background. The photograph sits on
 * white and the detail beneath it is tight, so a grid of forty reads as a
 * catalogue rather than forty floating panels. Whitespace separates.
 *
 * The order is the one every large marketplace has converged on, and it is an
 * order of decreasing importance rather than a description of the product:
 *
 *   image → name → price, was-price and discount on one line →
 *   rating and units sold → the delivery promise.
 *
 * The price leads the text because it is what a shopper scans a grid for. It is
 * set large and bold, with the struck-through original and the saving beside it
 * rather than on a line of their own — the three numbers only mean anything
 * read together, and splitting them costs a line of vertical space in a tile
 * that has none to spare.
 *
 * Colour is rationed: the resting price is near-black and only a discounted one
 * turns red, so red still means something; green is delivery and nothing else.
 *
 * Every figure comes from WooCommerce, and each line disappears when there is no
 * number behind it rather than printing a zero.
 */
/**
 * How wide this tile renders, as a `sizes` hint for the browser.
 *
 * The grid widths, since most cards are in a grid. A rail passes its own —
 * see below for why that is worth the prop.
 */
const GRID_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 20vw, 17vw";

export default function ProductCard({
  product,
  priority = false,
  sizes = GRID_SIZES,
}: {
  product: Product;
  /**
   * Load this card's photo immediately rather than lazily.
   *
   * Set only on the handful of cards that are already on screen when the page
   * opens. A lazy image is not requested until the browser has finished laying
   * the page out, which on a phone puts the shop's largest paint — the first
   * product photo — several hundred milliseconds behind where it could be. Off
   * by default: making every card eager would have them all compete for
   * bandwidth and would be slower than doing nothing.
   */
  priority?: boolean;
  /**
   * The width this tile actually occupies, per breakpoint.
   *
   * This is the single biggest lever on how fast product photography arrives,
   * and it was wrong everywhere the card appeared in a rail. `sizes` is what
   * the browser uses to pick a file out of the `srcset`; it is a promise about
   * layout, and a wrong one is not corrected by anything downstream. The value
   * was hard-coded to the grid's `50vw` on mobile, so a rail tile that renders
   * at 27vw was still being served the 50vw file — roughly four times the
   * pixels it can display, downloaded and decoded on a phone connection, for
   * every tile in every rail on the homepage.
   *
   * Defaulted rather than required so the several grids that were already
   * correct stay untouched.
   */
  sizes?: string;
}) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;
  const soldOut = product.stock_status === "outofstock";
  const lowStock =
    !soldOut && product.stock_quantity !== null && product.stock_quantity <= LOW_STOCK_AT;

  // Readable URLs — /products/blue-running-shoes, not /products/190.
  const href = `/products/${product.slug || product.id}`;
  const category = product.categories[0];

  /** The back view, when the seller uploaded one. */
  const secondPhoto = product.gallery.find((url) => url && url !== product.image) ?? null;

  /** Money off in shillings, which lands harder than a percentage. */
  const saving = discount > 0 ? product.regular_price - product.price : 0;

  /**
   * The sizes this product comes in — "40 · 41 · 42 +3".
   *
   * A shopper's second question, after "what does the back look like", is
   * "will it fit me", and a tile that answers it saves a click for the people
   * it fits and a wasted one for the people it does not.
   *
   * Two things were wrong with how it answered before.
   *
   * It read `attributes[0]` — whichever attribute the seller happened to enter
   * first. On half the catalogue that is Colour, so the line under the price
   * was "Black · Navy · Wine Red", which is information the photograph has
   * already given and which pushes the size out of the tile entirely. The
   * attribute is now *chosen*: a size-like one if the product has one, and only
   * then a fallback.
   *
   * And each option was drawn as a bordered chip, so four sizes cost four
   * boxes, eight borders and a wrapped second line on a 150px tile. Sizes are
   * numbers; they are read as a list, and a list is what they are set as now —
   * one line, dot-separated, truncated rather than wrapped. The borders were
   * the "unwanted" part of the tile.
   *
   * Colours keep their dots when the seller gave real hex values, because a dot
   * is the compact form of a colour in a way a word is not.
   */
  const sizeAttribute =
    product.attributes.find((attribute) => /siz|shoe|fit|uk|eu/i.test(attribute.name)) ??
    product.attributes.find(
      (attribute) => !/colou?r|shade/i.test(attribute.name)
    ) ??
    product.attributes[0];

  /**
   * Deduplicated and emptied out.
   *
   * WooCommerce quite happily stores the same option twice when a seller edits
   * an attribute by hand, and a tile reading "40 · 40 · 41" looks like a bug in
   * the shop rather than a repeat in the data.
   */
  const options = (sizeAttribute?.options ?? []).filter(
    (option, index, all) =>
      option.name.trim() !== "" &&
      all.findIndex((other) => other.name.trim() === option.name.trim()) === index
  );

  /** Colours are dots; everything else is the text list. */
  const isColourList = options.length > 0 && options.every((option) => option.value?.startsWith("#"));

  const swatches = options.slice(0, isColourList ? 5 : 4);
  const moreOptions = Math.max(0, options.length - swatches.length);

  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-transparent bg-white p-0.5 transition-colors hover:border-shop-line sm:p-1">
      {/* ---- Image ---- */}
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          {/* 4:5 rather than square. Clothes and shoes are photographed
              standing up, and a square crop of a portrait shot spends its
              height on floor and ceiling — the extra 25% goes to the garment,
              which on a phone is most of what the shopper can see at all. */}
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-shop-hairline">
            {product.image ? (
              <>
                {/* The eager branch below is `loading="eager"` +
                    `fetchPriority="high"`, not `priority`. Next 16 deprecated
                    `priority` in favour of `preload`, but `preload` is
                    explicitly the wrong tool here: the docs say not to use it
                    when several images could be the LCP depending on viewport,
                    and this flag is set on the first two tiles of a rail —
                    exactly that case. Two `<link rel=preload>` tags in the head
                    would fight each other. Eager loading with a high fetch
                    priority gets the same head start without the contention. */}
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes={sizes}
                  {...(priority
                    ? { loading: "eager" as const, fetchPriority: "high" as const }
                    : { loading: "lazy" as const })}
                  className={`object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02] ${
                    soldOut ? "opacity-50" : ""
                  } ${secondPhoto ? "group-hover:opacity-0" : ""}`}
                />

                {/* The second photograph, revealed on hover.
                    A shopper's first question about a garment is what the other
                    side looks like, and answering it without a page load is the
                    single most effective thing a tile can do. Only rendered when
                    the product genuinely has a second shot — a "hover" that
                    shows the same picture again reads as a glitch. */}
                {secondPhoto && (
                  <Image
                    src={secondPhoto}
                    alt=""
                    aria-hidden
                    fill
                    sizes={sizes}
                    loading="lazy"
                    className="object-cover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                  />
                )}
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-shop-muted">
                <svg className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <circle cx="8.5" cy="10" r="1.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 3-2 4 3" />
                </svg>
                <span className="text-[12px]">No image</span>
              </div>
            )}
          </div>
        </Link>

        {soldOut && (
          <span className="absolute left-2 top-2 rounded bg-shop-ink px-2 py-0.5 text-[11px] font-semibold text-white">
            Sold out
          </span>
        )}
        {/* ---- The discount flag ----
             A percentage on the photograph, and the argument for it is narrow
             enough to be worth writing down, because it was deliberately
             removed once.

             What was removed was a 56px orange medallion stamped across the
             middle of every discounted product. That was correct to kill: it
             covered the merchandise, and orange is this shop's brand colour, so
             a grid of forty of them read as decoration rather than as a
             number. What replaced it — the percentage beside the price — is
             where the number *means* the most, sitting between what the item
             costs and what it cost.

             But the price block is the last thing read, and on a rail that a
             thumb flicks past in under a second it is often the only thing not
             read at all. The discount is the single strongest reason to stop,
             and it was the one signal with no presence in the part of the tile
             a shopper actually looks at.

             So it is back — as a corner flag, not a medallion: 11px, top
             right, out of the subject of the shot, in sale red rather than the
             brand orange, and only on products with a genuine reduction. It
             does not replace the figure beside the price; that stays, because
             the two do different jobs — this one stops the scroll, that one
             closes the sale. */}
        {!soldOut && discount > 0 && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-shop-sale px-1.5 py-[3px] text-[11px] font-bold leading-none text-white shadow-sm">
            −{discount}%
          </span>
        )}

        {/* The reference card carries no heart, so it appears on hover — and on
            focus, so it stays reachable from the keyboard. Wishlisting is real
            functionality here; hiding it entirely would remove a feature to
            match a screenshot. */}
        <div className="absolute left-2 top-2 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <WishlistButton
            productId={product.id}
            name={product.name}
            image={product.image}
            price={product.price}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-shop-body shadow-sm backdrop-blur-sm transition-colors hover:text-shop-primary"
            iconClassName="w-[16px] h-[16px]"
          />
        </div>

        {/* Add-to-bag rides the corner of the photograph rather than sitting in
            the text below it. It buys back a whole line of the tile, and it is
            where a thumb already is after tapping the picture. */}
        <div className="absolute bottom-2 right-2 rounded-full bg-white/95 shadow-sm backdrop-blur-sm">
          <TileCartButton product={product} />
        </div>
      </div>

      {/* ---- Detail ----
           Tight on purpose: every pixel between these five short lines is a
           pixel of photograph the next row does not get. The photograph and the
           name it belongs to are one object, so they sit 2px apart rather than
           6 — at 6 the text read as a caption floating under the tile instead
           of part of it. */}
      <div className="mt-0.5 flex flex-1 flex-col gap-0.5">
        {/* Chips run inline with the name, so a tag costs no vertical space. */}
        <Link href={href} className="block">
          {/* 14/20 rather than 14/19: a supplier title always wraps to the full
              two lines, and a tight leading is felt most exactly where the text
              is longest. */}
          <h3 className="font-normal-heading line-clamp-2 text-[14px] leading-[20px] text-shop-ink transition-colors hover:text-shop-primary">
            <span className="mr-1 inline-block rounded-[3px] border border-shop-success/50 px-1 align-[1px] text-[10px] font-semibold text-shop-success">
              Local
            </span>
            {product.name}
          </h3>
        </Link>

        {/* The money, all on one line: what it costs, what it cost, what that
            saves. A discounted price turns red — the one place red is allowed —
            because at a glance the colour is the discount. */}
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span
            className={`price text-[19px] leading-none ${
              discount > 0 ? "text-shop-sale" : "text-shop-ink"
            }`}
          >
            {formatPrice(product.price)}
          </span>
          {discount > 0 && (
            <>
              <span className="text-[12.5px] leading-none text-shop-faint line-through">
                {formatPrice(product.regular_price)}
              </span>
              <span className="text-[12.5px] font-bold leading-none text-shop-sale">
                −{discount}%
              </span>
            </>
          )}
        </p>

        {/* What the discount is worth in money. "−17%" is arithmetic a shopper
            has to do; "Save UGX 5,000" is the answer. */}
        {saving > 0 && (
          <p className="text-[12.5px] font-semibold leading-none text-shop-success">
            Save {formatPrice(saving)}
          </p>
        )}

        {/* Rating and units sold on one line — the two numbers a shopper uses to
            decide whether anyone else has taken the risk first. */}
        {(product.rating_count > 0 || product.total_sales > 0) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {product.rating_count > 0 && (
              <span className="flex items-center gap-1">
                <Stars rating={product.average_rating} />
                <span className="text-[12.5px] font-semibold text-shop-body">
                  {product.average_rating.toFixed(1)}
                </span>
              </span>
            )}
            {product.total_sales > 0 && (
              <span className="text-[12.5px] font-medium text-shop-muted">
                {compactSold(product.total_sales)} sold
              </span>
            )}
          </div>
        )}

        {/* Sizes or colours, straight from the product's own attributes.
            A pure colour list is drawn as dots; everything else is one line of
            dot-separated text, because "40 · 41 · 42" is read at a glance and
            four bordered boxes are four objects to look at. */}
        {swatches.length > 0 &&
          (isColourList ? (
            <div className="flex flex-wrap items-center gap-1">
              {swatches.map((option) => (
                <span
                  key={option.name}
                  title={option.name}
                  className="h-3.5 w-3.5 rounded-full border border-shop-line"
                  style={{ backgroundColor: option.value }}
                />
              ))}
              {moreOptions > 0 && (
                <span className="text-[11px] leading-none text-shop-muted">+{moreOptions}</span>
              )}
            </div>
          ) : (
            /* `truncate` rather than wrapping: a product with nine sizes must
               not be a taller tile than the one beside it with two, or the rail
               stops being a row. The `+3` carries what the line could not. */
            <p className="truncate text-[11.5px] leading-none text-shop-body">
              {swatches.map((option) => option.name.trim()).join(" · ")}
              {moreOptions > 0 && (
                <span className="text-shop-muted"> +{moreOptions}</span>
              )}
            </p>
          ))}

        {/* One promotional line, earned from real figures rather than pasted on
            every card. Orange is reserved for this. */}
        {!soldOut && product.total_sales >= 50 && category ? (
          <p className="truncate text-[12.5px] font-medium text-shop-primary">
            Best Seller <span className="font-normal text-shop-body">in {category.name}</span>
          </p>
        ) : !soldOut && isNew(product) && category ? (
          <p className="truncate text-[12.5px] font-medium text-shop-primary">
            New Arrival <span className="font-normal text-shop-body">in {category.name}</span>
          </p>
        ) : null}

        <p className="mt-auto pt-0.5 text-[12.5px] font-medium text-shop-success">
          {soldOut ? (
            "Back in stock soon"
          ) : lowStock ? (
            <span className="flex items-center gap-1.5 text-shop-sale">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-shop-sale" aria-hidden />
              Only {product.stock_quantity} left
            </span>
          ) : (
            /* Not "free delivery" — that depends on the basket total, and a tile
               cannot know it. Promising it here would be a lie on most orders. */
            "Fastest delivery: 1 business day"
          )}
        </p>
      </div>
    </article>
  );
}
