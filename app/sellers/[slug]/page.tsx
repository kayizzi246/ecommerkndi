import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductsSafe, getStores } from "@/lib/woocommerce";
import ProductCard from "@/components/ProductCard";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const store = (await getStores()).find((entry) => entry.store_slug === slug);

  return {
    title: store ? store.store_name : "Store",
    description: store
      ? `Shop ${store.product_count} products from ${store.store_name} on Kandi.`
      : undefined,
  };
}

/** Everything one marketplace store sells, filtered server-side by slug. */
export default async function StorePage({ params }: Params) {
  const { slug } = await params;

  const store = (await getStores()).find((entry) => entry.store_slug === slug);
  if (!store) notFound();

  const { products } = await getProductsSafe({ seller: slug, per_page: 48 });

  return (
    <main className="mx-auto max-w-[1450px] px-4 pb-24 pt-6 md:px-8 lg:pb-16">
      <nav className="mb-6 flex items-center gap-2 text-[13px] text-shop-muted">
        <Link href="/" className="hover:text-shop-primary">
          Home
        </Link>
        <span aria-hidden>›</span>
        <Link href="/sellers" className="hover:text-shop-primary">
          Shop by store
        </Link>
        <span aria-hidden>›</span>
        <span className="text-shop-ink">{store.store_name}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-5 rounded-2xl border border-shop-line bg-white p-6">
        {store.logo ? (
          <Image
            src={store.logo}
            alt=""
            width={72}
            height={72}
            unoptimized
            className="h-18 w-18 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-shop-primary-soft text-[26px] font-semibold text-shop-primary">
            {store.store_name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-tight text-shop-ink md:text-[30px]">
            {store.store_name}
          </h1>
          <p className="mt-1 text-[15px] text-shop-muted">
            {store.product_count} {store.product_count === 1 ? "product" : "products"} · sold and
            dispatched through Kandi
          </p>
        </div>
        <span className="ml-auto rounded-full bg-shop-successbg px-3 py-1.5 text-[13px] font-semibold text-shop-success">
          Approved store
        </span>
      </header>

      {products.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-shop-line bg-white p-10 text-center">
          <p className="text-[16px] text-shop-muted">
            This store has nothing listed right now. Check back soon.
          </p>
          <Link href="/sellers" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
            Browse other stores
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
