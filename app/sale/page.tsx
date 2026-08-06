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
    <main className="mx-auto max-w-[1440px] px-4 pb-24 pt-4 md:px-8 lg:pb-10">
      {/* Breadcrumbs */}
      <nav className="mb-4 flex items-center gap-2 text-[13px] text-[#555]">
        <Link href="/" className="hover:text-black hover:underline">
          Home
        </Link>
        <span className="text-[#999]">›</span>
        <span className="text-black">Super Price Store</span>
      </nav>

      {/* Hero */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-5 bg-bfl-red px-6 py-7 text-white md:px-10">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/80">
            Limited time
          </p>
          <h1 className="mt-1 text-[32px] font-bold leading-none md:text-[42px]">
            Super Price Store
          </h1>
          <p className="mt-2 text-[14px] text-white/85">
            {total} {total === 1 ? "item" : "items"} at their lowest price.
          </p>
        </div>
        <div className="bg-bfl-yellow px-6 py-3 text-center text-black">
          <p className="text-[11px] font-bold uppercase tracking-wide">Ends in</p>
          <p className="text-[20px] font-bold">
            <FlashSaleCountdown />
          </p>
        </div>
      </div>

      {/* Result bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-bfl-line pb-4">
        <p className="text-[13px] text-bfl-grey">
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
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
    <div className="border border-bfl-line bg-bfl-surface px-6 py-16 text-center">
      <p className="text-[16px] font-bold text-black">{title}</p>
      <p className="mt-1.5 text-[13px] text-bfl-grey">{copy}</p>
      <Link href="/" className="btn-bfl mt-5 inline-block px-6 py-2.5 text-[13px]">
        Continue shopping
      </Link>
    </div>
  );
}
