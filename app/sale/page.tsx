import Link from "next/link";
import { getProductsSafe } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";

export const metadata = { title: "Sale" };

export default async function SalePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { products, total, total_pages } = await getProductsSafe({
    on_sale: true,
    page,
    per_page: 24,
  });

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      <h1 className="text-2xl tracking-[0.25em] uppercase font-semibold text-sale mb-1">
        Sale
      </h1>
      <p className="text-xs tracking-[0.15em] uppercase text-gray-500 mb-10">
        {total} products
      </p>

      {products.length === 0 ? (
        <div className="border border-dashed border-gray-300 p-12 text-center text-gray-600">
          <p className="tracking-[0.2em] uppercase font-semibold mb-3">
            No sale items right now
          </p>
          <Link
            href="/"
            className="text-[11px] tracking-[0.25em] uppercase underline underline-offset-8"
          >
            Back to shop
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {total_pages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-14">
              {page > 1 && (
                <Link
                  href={`/sale?page=${page - 1}`}
                  className="text-[11px] tracking-[0.25em] uppercase underline underline-offset-8"
                >
                  Previous
                </Link>
              )}
              <span className="text-[11px] tracking-[0.2em] uppercase text-gray-500">
                Page {page} / {total_pages}
              </span>
              {page < total_pages && (
                <Link
                  href={`/sale?page=${page + 1}`}
                  className="text-[11px] tracking-[0.25em] uppercase underline underline-offset-8"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
