import { NextResponse } from "next/server";
import { getProductsSafe } from "@/lib/woocommerce";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const { products } = await getProductsSafe({ search: q, per_page: 6 });

  return NextResponse.json({
    suggestions: products.map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      price: p.price,
      regular_price: p.regular_price,
      on_sale: p.on_sale,
      category: p.categories[0]?.name ?? "",
    })),
  });
}
