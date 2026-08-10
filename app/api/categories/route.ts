import { getCategories } from "@/lib/woocommerce";

/**
 * The shop's real WooCommerce categories, for any browser-side screen that has
 * to offer a category picker.
 *
 * This exists so that a seller listing a product and a shopper browsing one are
 * choosing from the same list. The seller form used to carry its own hard-coded
 * array — "Sportswear", "Bags & accessories" — none of which existed in
 * WooCommerce, so every listing created a brand new category and the buyer's
 * department tree filled up with near-duplicates nobody could shop.
 *
 * Public and read-only, like the category list on the storefront itself.
 */
export async function GET() {
  const categories = await getCategories();

  return Response.json({
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent: category.parent ?? 0,
      count: category.count ?? 0,
    })),
  });
}
