import Link from "next/link";
import { getProductsSafe } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { products, total, total_pages } = await getProductsSafe({
    category: slug,
    page,
    per_page: 24,
  });

  const title = slug.replace(/-/g, " ");

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold capitalize mb-1">{title}</h1>
      <p className="text-sm text-gray-500 mb-6">{total} products</p>

      {products.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-600">
          <p className="font-semibold mb-2">Nothing in this category yet.</p>
          <Link href="/" className="text-kandi font-semibold hover:underline">
            ← Back to shop
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {total_pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`/category/${slug}?page=${page - 1}`}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold hover:border-kandi"
                >
                  ← Previous
                </Link>
              )}
              <span className="px-4 py-2 text-sm text-gray-500">
                Page {page} of {total_pages}
              </span>
              {page < total_pages && (
                <Link
                  href={`/category/${slug}?page=${page + 1}`}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold hover:border-kandi"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
