import { getProduct, getProductsSafe } from "@/lib/woocommerce";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isInteger(productId) || productId <= 0) {
    return Response.json({ error: "Invalid product id" }, { status: 400 });
  }

  const product = await getProduct(productId);
  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  const category = product.categories[0];
  const relatedResponse = category
    ? await getProductsSafe({ category: category.slug, per_page: 6 })
    : { products: [] };
  const related = relatedResponse.products
    .filter((item) => item.id !== product.id)
    .slice(0, 5);

  return Response.json({ product, related });
}
