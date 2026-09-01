import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import { discountPercent, formatPrice } from "@/lib/currency";
import { productPath } from "@/lib/seo";

/**
 * A product at thumbnail size: the picture, the price, and nothing else.
 *
 * This is the tile the portal panels are built from — the subsidies grid beside
 * the campaign banner, and the two products inside each feature card. It is
 * deliberately NOT `ProductCard`, and the reason is that the two are answering
 * different questions.
 *
 * `ProductCard` is a full tile in a grid a shopper is scanning to choose from,
 * so it carries the name, the rating, the sold count, the saving, the stock
 * warning and an add-to-basket control. Six of those inside a 100px panel cell
 * is not a smaller card, it is an unreadable one — the panel would be three
 * lines of 9px grey text per product and no photograph worth looking at.
 *
 * What a panel tile has to do is much narrower: show that the panel has real
 * stock behind it, and show what that stock costs. So it prints the picture at
 * the largest size the cell allows and one number under it. The name is still
 * there for anyone not looking at the screen — it is the link's accessible name
 * — it simply is not drawn.
 */
export default function MiniProduct({
  product,
  /**
   * The width this thumbnail actually renders at, per breakpoint.
   *
   * Defaulted rather than required, and the default is deliberately small: every
   * caller of this component draws it inside a panel column, so a tile here is
   * never more than about a sixth of the page. Passing the grid's `sizes` string
   * would have the browser fetch a 300px file for a 90px box, which on the
   * homepage is a dozen of them.
   */
  sizes = "(max-width: 768px) 22vw, 130px",
}: {
  product: Product;
  sizes?: string;
}) {
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;

  return (
    <Link
      href={productPath(product)}
      // The name is the accessible name of the link, which is what makes a
      // grid of pictures navigable by anyone reading the page rather than
      // looking at it. The price goes in with it: a link announced as "Nike
      // Air Max" when the panel's whole claim is the price is only half read
      // out.
      aria-label={`${product.name} — ${formatPrice(product.price)}`}
      className="group block"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-shop-photo ring-1 ring-shop-edge">
        {product.image ? (
          <Image
            quality={90}
            src={product.image}
            alt=""
            fill
            sizes={sizes}
            loading="lazy"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] text-shop-faint">
            No photo
          </span>
        )}

        {/* The cut, top left. Only ever drawn on a genuine reduction — a flag
            on every tile is a flag that means nothing, which is the rule the
            full card is held to as well. */}
        {discount > 0 && (
          <span className="absolute left-1 top-1 rounded-full bg-shop-primary px-1.5 py-0.5 text-[10px] font-bold leading-tight text-shop-ink shadow-[0_3px_8px_-3px_rgba(255,106,0,0.9)]">
            -{discount}%
          </span>
        )}
      </div>

      {/* ---- And now it is a line of text again ----

          It was a chip: a filled yellow box under every thumbnail, on the
          argument that a bare number under a photograph reads as a caption
          where the same number in a box reads as a price tag, and that yellow
          was where this shop's deal language lived.

          Both halves of that stopped being true. The deal language is orange
          now — the corner flag on a grid tile and the Super Deal chip both
          moved off `bfl-yellow` — so a yellow price tag is no longer the same
          voice those are speaking, it is a fifth accent with nothing else
          wearing it. And the panels these thumbnails sit in are white cards on
          a cream page, where four filled yellow blocks in a row are the
          heaviest thing on the homepage by a distance. That weight is the whole
          complaint this pass is answering.

          A bare number is enough here because the cell now has an edge of its
          own — the thumbnail is a ringed, rounded frame — so the price reads as
          belonging to the picture above it rather than floating under it.
          `.price` is the shop's tabular price face, which is what every other
          number in the store is set in. */}
      <span className="price mt-1.5 block max-w-full truncate text-[12px] text-shop-ink">
        {formatPrice(product.price)}
      </span>
    </Link>
  );
}
