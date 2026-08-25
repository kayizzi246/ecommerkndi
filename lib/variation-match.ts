import type { Product, ProductVariation } from "@/lib/woocommerce";

/**
 * Turns "the shopper picked size 38 in red" into the WooCommerce variation that
 * actually is.
 *
 * ---- Why this needs to exist at all ----
 *
 * The two places a shopper can choose options — `AddToCartButton` on the
 * product page and `VariantSheet` from the tiles and the sticky bar — both used
 * to put the CHOICE in the basket and nothing else: `{ Size: "38" }` as free
 * text, hung off the parent product's id. Everything downstream then had to
 * pretend that was the same thing as knowing what had been bought, and it is
 * not: WooCommerce priced the order from the parent and moved the parent's
 * stock, so a large that costs more sold at the small's price and a sold-out
 * size kept selling.
 *
 * Both call this instead, so there is one answer to "which variation is that"
 * rather than two implementations that can disagree about it.
 *
 * ---- Deliberately pure, and deliberately in its own file ----
 *
 * `lib/woocommerce.ts` is where this logically belongs and is the one place it
 * must not live: that module reaches for `fetch` and the environment, and both
 * callers are client components. Importing it there would drag the backend
 * client into the browser bundle.
 */

/**
 * The variation matching every chosen option, or null.
 *
 * Null covers three quite different situations, and callers should treat them
 * the same way — do not send an id:
 *
 *   • the product is simple and has no variations;
 *   • not every attribute has been chosen yet;
 *   • the WordPress install is running a plugin old enough that it does not
 *     send variation ids, so there is nothing to match to.
 *
 * The last one is the reason this returns null rather than throwing. An
 * out-of-date backend should not break the add-to-cart button in the browser;
 * it should fail at the order, where `kandi-store-api.php` refuses a variable
 * product with no variation named and says so in words the shopper can act on.
 */
export function matchVariation(
  product: Pick<Product, "variations" | "attributes">,
  selected: Record<string, string | null | undefined>
): ProductVariation | null {
  const variations = product.variations;
  if (!variations || variations.length === 0) return null;

  const chosen = Object.entries(selected).filter(
    (entry): entry is [string, string] => Boolean(entry[1])
  );

  // Every attribute the product has must have been answered. A partial match
  // would silently pick the first variation that happened to fit, which is how
  // a shopper who chose a colour and forgot the size ends up with a size.
  const required = (product.attributes ?? []).filter((attr) => attr.options.length > 0);
  if (chosen.length < required.length) return null;

  const match = variations.find((variation) =>
    chosen.every(([name, value]) => variation.attributes[name] === value)
  );

  // An id of 0 or undefined is a backend that cannot name its variations; that
  // is not a match, whatever the attributes say.
  return match && typeof match.id === "number" && match.id > 0 ? match : null;
}

/**
 * What this line should cost per unit, given the choice.
 *
 * The variation's own price when the backend sends one, and the parent's
 * otherwise. Cosmetic — the order is priced server-side from the same
 * variation — but it is what stops the basket showing one figure and the
 * invoice another on a product whose sizes are priced differently.
 */
export function variationPrice(
  product: Pick<Product, "price" | "variations" | "attributes">,
  selected: Record<string, string | null | undefined>
): number {
  const match = matchVariation(product, selected);
  return typeof match?.price === "number" && match.price > 0 ? match.price : product.price;
}
