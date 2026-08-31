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
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-shop-hairline ring-1 ring-shop-ink/[0.04]">
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
          <span className="absolute left-0 top-0 rounded-br-lg bg-shop-primary px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white">
            -{discount}%
          </span>
        )}
      </div>

      {/* ---- The price is a chip, not a line of text ----

          The reference sets every thumbnail price in a bordered box, and the
          reason it works is that a panel of pictures has no other typography in
          it: a bare number under a photograph reads as a caption, where the same
          number in a chip reads as a price tag. It is the only ink in the cell,
          so it may as well be the loudest thing in it.

          ---- Yellow, and it is the shop's own yellow ----

          This was orange on the brand's soft tint, and the trouble with that is
          that the panels these chips sit in are ALSO orange — the campaign band
          beside them, the discount flag above them, the sale channel above
          that. An orange chip on a page of orange is a chip that has to be
          looked for.

          `bfl-yellow` is where the deal language already lives in this shop:
          the "-35%" flag on a grid tile and the Super Deal chip both take it,
          so a yellow price tag is the same voice those are speaking rather than
          a fifth accent. It is also the strongest pairing available — near-black
          on #facc15 is about 11:1, where the orange-on-tint it replaces was
          5.9:1 — which matters at 11.5px more than it does anywhere else on the
          page. */}
      <span className="mt-1.5 inline-flex max-w-full items-center truncate rounded-md bg-bfl-yellow px-1.5 py-0.5 text-[11.5px] font-bold leading-tight text-shop-ink">
        {formatPrice(product.price)}
      </span>
    </Link>
  );
}
