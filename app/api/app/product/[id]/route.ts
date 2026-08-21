import { getProduct, getProductReviews, getProductsSafe } from "@/lib/woocommerce";
import { getSiteSettings } from "@/lib/site-settings";
import { toAppProduct, appImage, APP_CACHE_HEADERS } from "@/lib/app-api";

/**
 * GET /api/app/product/{idOrSlug}
 *
 * One product, in the detail the app's product page needs: the full
 * description, every photograph, the attribute table, the review summary, the
 * shop's delivery terms, and a rail of related products.
 *
 * ---- Why this endpoint exists ----
 *
 * The app's product page read Supabase directly — a `products` table filled by
 * a sync plugin — while every other screen in the app, and the entire website,
 * reads WooCommerce. Two databases cannot show one catalogue: the ids do not
 * even refer to the same rows, so tapping a product on the home screen and
 * landing on a Supabase lookup of that id finds either nothing or, worse, a
 * different product. That is the last v2 screen still on the old source, and
 * this is what replaces it.
 *
 * `toAppProduct` is reused rather than reimplemented for the reason written on
 * it: two serialisers means two chances to disagree about what "reduced" means,
 * and the app would then show one price on the home rail and another on the
 * page it opens.
 *
 * ---- What is added on top of the shared shape ----
 *
 * Everything a tile does not need and a detail page cannot do without. It is
 * one request rather than four because a phone on a Ugandan connection pays for
 * every round trip, and none of these can be shown until all of them arrive.
 */

export const revalidate = 60;

/**
 * One attribute, in both shapes.
 *
 * `values` is the old flat list and is kept for builds already parsing it;
 * `options` carries the same names with the swatch image beside them, which is
 * what a colour picker needs and a size picker ignores.
 *
 * `value` is the swatch COLOUR — the hex or CSS colour word the seller set on
 * the term, which is what the website's `ColorSwatch` fills its dots with
 * (`option.value || option.name.toLowerCase()`). The app was being sent the
 * image and not this, so a shop that had coloured its terms rather than
 * photographed them gave the app nothing to draw and it fell back to printing
 * the word. Both are sent now, and the client prefers the photograph when
 * there is one, exactly as the site does.
 */
type AttributeOptionRow = {
  name: string;
  value: string | null;
  image: string | null;
};
type AttributeRow = { name: string; values: string[]; options: AttributeOptionRow[] };

/**
 * One buyable combination — { Size: "42", Color: "Black" } and whether it is on
 * the shelf.
 *
 * ---- Why this is now sent ----
 *
 * The website greys out and strikes through the combinations that do not
 * exist: pick Red and the sizes Red was never made in go dead, because
 * `AddToCartButton` has `product.variations` to check against. The app had no
 * such field, so every option was offered as if available — and the only place
 * a shopper found out otherwise was a rejected order.
 *
 * The shape is deliberately the same as the website's `ProductVariation`
 * (attribute name → chosen value, plus a stock flag) rather than something
 * app-shaped, so the availability rule can be the same rule in both clients
 * instead of two implementations that drift.
 */
type VariationRow = { attributes: Record<string, string>; inStock: boolean };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Missing product id" }, { status: 400 });
  }

  // Accepts a slug or a numeric id, exactly as the website's own product route
  // does — so a link built from either opens the same product.
  const product = await getProduct(id);

  if (!product) {
    return Response.json(
      { error: "Product not found" },
      { status: 404, headers: APP_CACHE_HEADERS }
    );
  }

  /**
   * The rest, in one round of requests rather than three.
   *
   * Only the related rail depends on the product, and only for its category,
   * so nothing here has to wait on anything else. Failures are absorbed
   * individually: a product page with no reviews is a product page, but a
   * product page that 500s because the review endpoint hiccuped is nothing.
   */
  const category = product.categories[0];

  const [reviews, settings, related] = await Promise.all([
    getProductReviews(product.id).catch(() => ({
      reviews: [],
      average_rating: 0,
      rating_count: 0,
    })),
    getSiteSettings(),
    category
      ? getProductsSafe({ category: category.slug, per_page: 12 }).catch(() => ({
          products: [],
        }))
      : Promise.resolve({ products: [] }),
  ]);

  /**
   * The attribute table — size, colour, material, whatever the seller filled in.
   *
   * ---- Why this now sends `options` as well as `values` ----
   *
   * It used to send names only, on the reasoning that the app "renders a spec
   * list and has no use for the option objects". That stopped being true when
   * the app grew real size and colour pickers: a colour is the one attribute
   * whose VALUE is not the thing a shopper is choosing. "Dark Brown" beside
   * "Tan" beside "Oxblood" is three words to read and compare, where the
   * website shows three swatches and the choice is made without reading
   * anything — and the swatch image is exactly what was being thrown away here.
   *
   * `values` stays, unchanged and first, because a shipped build of the app is
   * parsing it right now and an endpoint that drops a field is an endpoint that
   * breaks every phone that has not updated. `options` is additive: same order,
   * same names, plus the image when the seller uploaded one.
   */
  const attributes: AttributeRow[] = (product.attributes ?? [])
    .map((attribute) => ({
      name: attribute.name,
      values: attribute.options.map((option) => option.name).filter(Boolean),
      options: attribute.options
        .filter((option) => Boolean(option.name))
        .map((option) => ({
          name: option.name,
          value: option.value ?? null,
          image: option.image ? appImage(option.image, 256) : null,
        })),
    }))
    .filter((row) => row.name && row.values.length > 0);

  /**
   * Which combinations are real, and which of those are in stock.
   *
   * Sent whole rather than pre-collapsed into "these options are dead",
   * because availability depends on what the shopper has picked SO FAR — Red
   * may be made in 42 and not in 44, so the answer for 44 changes the moment
   * Red is chosen. Only the client knows the current selection, so only the
   * client can compute it, and it needs the table to do so.
   *
   * A simple product has no variations and gets an empty array, which the
   * client reads as "everything is available" — the same fallback the website
   * takes when `product.variations` is undefined.
   */
  const variations: VariationRow[] = (product.variations ?? []).map((variation) => ({
    attributes: variation.attributes,
    inStock: variation.is_in_stock,
  }));

  return Response.json(
    {
      // The tile shape, unchanged, so the app can reuse the same model it
      // already parses on the home and category screens.
      product: {
        ...toAppProduct(product),

        /** Full HTML description. The app strips tags; it is sent whole so a
         *  future in-app renderer does not need a new endpoint. */
        description: product.description ?? "",
        shortDescription: product.short_description ?? "",

        /** Every photograph, not the six a tile is capped at. */
        /* Built from the serialised product, not the raw one: `toAppProduct`
           has already routed both the tile shot and the gallery through the
           image optimiser, and reaching past it to `product` here would put
           the unoptimised WordPress originals back on the one screen that
           shows the biggest pictures. */
        images: [appImage(product.image, 1080), ...product.gallery.slice(0, 6).map((url) => appImage(url, 1080))].filter(Boolean),

        attributes,
        variations,

        /** Who is selling it, when it is a marketplace listing. */
        seller: product.seller
          ? {
              name: product.seller.store_name,
              slug: product.seller.store_slug,
              logo: product.seller.logo ?? null,
            }
          : null,
      },

      /**
       * The review summary and the five-star split.
       *
       * Index 0 is five stars, matching the order the bars are drawn in on the
       * website — so the app and the site cannot describe the same reviews
       * differently.
       */
      reviews: {
        average: reviews.average_rating,
        count: reviews.rating_count,
        breakdown: reviews.reviews.reduce<number[]>(
          (bars, review) => {
            const index = 5 - review.rating;
            if (index >= 0 && index < 5) bars[index] += 1;
            return bars;
          },
          [0, 0, 0, 0, 0]
        ),
        latest: reviews.reviews.slice(0, 5).map((review) => ({
          author: review.author,
          rating: review.rating,
          verified: review.verified,
          // Tags stripped here rather than in Dart: WooCommerce wraps every
          // review in <p>, and an app printing that markup is a bug the server
          // can prevent once instead of every client fixing it.
          body: (review.text ?? "").replace(/<[^>]*>/g, " ").trim(),
          date: review.date,
        })),
      },

      /**
       * The shop's published terms, so the page can state them without
       * hardcoding a number that wp-admin can change. The same values the
       * checkout charges against.
       */
      commerce: {
        freeDeliveryFrom: settings.commerce.free_delivery_from,
        returnsDays: settings.commerce.returns_days,
      },

      /** "You may also like" — same category, this product removed. */
      related: related.products
        .filter((item) => item.id !== product.id)
        .slice(0, 10)
        .map(toAppProduct),
    },
    { headers: APP_CACHE_HEADERS }
  );
}
