import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getStores } from "@/lib/woocommerce";
import InfoPage, { InfoFooterCta } from "@/components/InfoPage";

export const metadata: Metadata = {
  alternates: { canonical: "/sellers" },
  title: "Shop by store",
  description: "Browse the independent Ugandan stores selling on Kandi.",
};

export default async function StoresPage() {
  const stores = await getStores();

  return (
    <InfoPage
      eyebrow="Marketplace"
      title="Shop by store"
      intro="Independent Ugandan stores selling through Kandi. Every one is approved before it can list a single product, and every order is covered by the same delivery and returns promise."
    >
      {stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-shop-line bg-white p-10 text-center">
          <p className="text-[17px] font-semibold text-shop-ink">No stores listed yet</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-shop-muted">
            We are approving the first marketplace stores now. In the meantime, everything on the
            site is sold and dispatched by Kandi directly.
          </p>
          <Link href="/" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
            Browse all products
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                href={`/sellers/${store.store_slug}`}
                className="flex h-full items-center gap-4 rounded-2xl border border-shop-line bg-white p-5 transition-colors hover:border-shop-primary"
              >
                {store.logo ? (
                  <Image
                    src={store.logo}
                    alt=""
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-shop-primary-soft text-[21px] font-semibold text-shop-primary">
                    {store.store_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-semibold text-shop-ink">
                    {store.store_name}
                  </p>
                  <p className="mt-0.5 text-[14px] text-shop-muted">
                    {store.product_count}{" "}
                    {store.product_count === 1 ? "product" : "products"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <InfoFooterCta
        text="Selling shoes or fashion? Open your own store."
        href="/sell"
        label="Become a seller"
      />
    </InfoPage>
  );
}
