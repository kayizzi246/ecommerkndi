import Link from "next/link";
import { getProductsSafe } from "@/lib/woocommerce";
import { sortProducts } from "@/lib/sort-products";
import ProductCard from "@/components/ProductCard";
import SortDropdown from "@/components/SortDropdown";
import Pagination from "@/components/Pagination";
import FlashSaleCountdown from "@/components/FlashSaleCountdown";

export const metadata = { title: "Super Price Store" };

export default async function SalePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { page: pageParam, sort } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { products, total, total_pages } = await getProductsSafe({
    on_sale: true,
    page,
    per_page: 24,
  });

  const sorted = sortProducts(products, sort);

  return (
    <main className="w-full px-4 pb-24 pt-4 md:px-8 lg:pb-12">
      {/* Breadcrumbs */}
      <nav className="mb-5 flex items-center gap-2 text-[13px] text-shop-muted">
        <Link href="/" className="hover:text-shop-ink">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="text-shop-ink">Super Price Store</span>
      </nav>

      {/* Hero */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-lg bg-shop-sale px-6 py-8 text-white md:px-10">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/80">
            Limited time
          </p>
          <h1 className="mt-1 section-title text-[34px] md:text-[44px]">
            Super Price Store
          </h1>
          <p className="mt-2 text-[15px] text-white/85">
            {total} {total === 1 ? "item" : "items"} at their lowest price.
          </p>
        </div>
        <div className="rounded-lg bg-white px-6 py-3 text-center text-shop-ink">
          <p className="text-[12px] font-semibold uppercase tracking-wide">Ends in</p>
          <p className="text-[22px] font-semibold">
            <FlashSaleCountdown />
          </p>
        </div>
      </div>

      {/* Result bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-shop-line pb-4">
        <p className="text-[14px] text-shop-muted">
          Showing {sorted.length} of {total} deals
        </p>
        <SortDropdown />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No deals running right now"
          copy="Check back soon — the Super Price Store refreshes every week."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sorted.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pagination basePath="/sale" page={page} totalPages={total_pages} params={{ sort }} />
        </>
      )}
    </main>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-lg border border-shop-line bg-white px-6 py-20 text-center">
      <p className="text-[18px] font-semibold text-shop-ink">{title}</p>
      <p className="mt-2 text-[14px] text-shop-muted">{copy}</p>
      <Link href="/" className="btn-shop mt-6 px-6 py-2.5 text-[14px]">
        Continue shopping
      </Link>
    </div>
  );
}
