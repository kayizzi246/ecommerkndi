import { formatPrice, discountPercent } from "@/lib/currency";
import type { Product } from "@/lib/woocommerce";

/**
 * The description a product gets when the seller has not written one.
 *
 * ---- Why this exists ----
 *
 * A third of this catalogue arrives from WooCommerce with `description` and
 * `short_description` both empty, and the Description tab rendered a single
 * bullet — "Style code: KD-1443" — under a heading promising a description.
 * That is worse than an empty tab: it tells a shopper the shop has nothing to
 * say about the thing it is asking them to buy, and it gives Google a page
 * whose largest block of text is a SKU.
 *
 * ---- The one rule this file lives by ----
 *
 * NOTHING HERE IS INVENTED. Every sentence below is a restatement of a field
 * the product already carries — its name, its categories, its attributes, its
 * price, its stock, its seller, what it has sold. No materials, no
 * measurements, no country of origin, no care instructions, no "premium
 * quality".
 *
 * That rule is not stylistic. `product-descriptions.md` in the repo root makes
 * the same argument for the hand-written copy and it is the reason the
 * `detailRows` table on the product page dropped its invented care rows: a
 * description that states a fact the product does not have produces returns,
 * disputes and chargebacks, and a shopper who catches ONE invented line stops
 * believing the rest of the page — including the parts that are true.
 *
 * So the copy here is deliberately plain. It reads as a shop describing its
 * own listing, because that is all the data supports, and a seller's real
 * description always wins over it (see the call site: this is only reached
 * when both WooCommerce fields are empty).
 *
 * ---- Why not have a model write them ----
 *
 * Because it would be a generation per product per build, it would need a key
 * on the server, and — the part that actually decides it — a model given a
 * title and a price will happily produce "crafted from durable stainless
 * steel", which is exactly the failure above. The place for real copy is
 * wp-admin, and `product-descriptions.md` is the drafting workflow for it.
 * This is the floor under an empty field, not a replacement for writing one.
 */

/** Sentence-cases a category name for use mid-sentence. */
function lower(name: string): string {
  // Left alone when it is an acronym or a proper noun the shop has capitalised
  // deliberately — "TVs", "HP" — which a blanket toLowerCase would mangle.
  return /^[A-Z][a-z]/.test(name) ? name.toLowerCase() : name;
}

/**
 * Two to four sentences describing the product from its own record.
 *
 * Returns an empty array when there is genuinely nothing to say — a product
 * with no category, no attributes and no price — so the caller can fall back
 * rather than print a paragraph of hedges.
 */
export function autoDescription(product: Product): string[] {
  const paragraphs: string[] = [];

  const category = product.categories[0]?.name;
  const sub = product.categories[1]?.name;
  const seller = product.seller?.store_name;

  /* Sentence one: what it is and where it sits in the shop. The name is the
     one string always present, and the category is what turns it from a label
     into a placement — "in women's jewellery" is information a shopper who
     arrived from a search does not otherwise have. */
  paragraphs.push(
    [
      `${product.name}`,
      category ? ` is listed in ${lower(category)}` : " is listed",
      sub && sub !== category ? ` under ${lower(sub)}` : "",
      seller ? ` and is sold by ${seller}, an independent store on KandiUg` : " on KandiUg",
      ".",
    ].join("")
  );

  /* Sentence two: the attributes, which are the only genuine SPECIFICATIONS in
     the record. Listed rather than described — "Available in Gold, Silver" is
     what the data says; "available in a range of elegant finishes" is not. */
  const specs = (product.attributes ?? [])
    .filter((attr) => attr.options.length > 0)
    .slice(0, 3)
    .map((attr) => `${lower(attr.name)}: ${attr.options.map((o) => o.name).join(", ")}`);

  if (specs.length > 0) {
    paragraphs.push(
      `Options on this listing — ${specs.join("; ")}. Pick yours above before adding it to the basket.`
    );
  }

  /* Sentence three: the price, said the way people search for it. The same
     phrasing as `metaDescription` in lib/seo.ts, and deliberately so — a
     shopper who arrived on "earrings price in uganda" should find the sentence
     that matched them repeated on the page rather than contradicted. */
  const discount = product.on_sale
    ? discountPercent(product.regular_price, product.price)
    : 0;

  if (product.price > 0) {
    paragraphs.push(
      discount > 0
        ? `Price in Uganda: ${formatPrice(product.price)}, reduced ${discount}% from ${formatPrice(product.regular_price)} — a saving of ${formatPrice(product.regular_price - product.price)}.`
        : `Price in Uganda: ${formatPrice(product.price)}.`
    );
  }

  /* Sentence four: what other shoppers have done, but ONLY at a volume where
     it means something. "1 sold" is not social proof, it is an accident of
     when the page was loaded. */
  if (product.total_sales >= 10) {
    paragraphs.push(
      `${product.total_sales} sold so far${
        product.rating_count > 0
          ? `, rated ${product.average_rating.toFixed(1)} out of 5 by ${product.rating_count} ${
              product.rating_count === 1 ? "shopper" : "shoppers"
            }`
          : ""
      }.`
    );
  }

  /* One sentence and no specs is a caption, not a description — the caller is
     better off with its own fallback than with a single restated title. */
  return paragraphs.length >= 2 ? paragraphs : [];
}

/**
 * Whether the seller wrote anything at all.
 *
 * `short_description` arrives as HTML — WordPress wraps even one word in `<p>`
 * — so an "empty" field is frequently `"<p></p>\n"` and a plain truthiness
 * check on it passes. That is what made this worth a function: the tab was
 * choosing the seller's copy over the generated copy on the strength of a pair
 * of empty tags.
 */
export function hasOwnDescription(product: Product): boolean {
  const text = `${product.short_description ?? ""} ${product.description ?? ""}`
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();

  return text.length > 0;
}
