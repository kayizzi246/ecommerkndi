import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getStores, getProductsSafe, type Product, type Store } from "@/lib/woocommerce";
import { formatPrice } from "@/lib/currency";
import { InfoFooterCta } from "@/components/InfoPage";

export const metadata: Metadata = {
  alternates: { canonical: "/sellers" },
  title: "Shop by store",
  description: "Browse the independent Ugandan stores selling on Kandi.",
};

/** How many products preview each store. Four fills the strip at every width. */
const PREVIEW_COUNT = 4;

/**
 * Shop by store.
 *
 * Rebuilt to the shape AliExpress uses for its store directory, and the change
 * is not decoration — it is what turns a list of names into a place to shop.
 *
 * The page used to be a two-column grid of cards carrying an initial, a store
 * name and a product count. Nothing on it was a reason to click. A shopper has
 * no idea what "Sports Kicks" sells, and "14 products" does not tell them; the
 * only way to find out was to open the store and come back. A directory whose
 * every entry costs a round trip to evaluate is a directory nobody uses.
 *
 * So each store now shows its merchandise. The card is one row per store —
 * identity on the left, four of its actual products on the right — which is the
 * AliExpress pattern and works for the same reason: the products are the answer
 * to the only question the page raises.
 *
 * ---- On the empty stores ----
 *
 * Two of this shop's three stores have no products, and a directory that leads
 * with empty shelves reads as an abandoned marketplace. They are sorted to the
 * bottom rather than hidden — they are real approved sellers and their pages
 * exist — and their cards say plainly that they are still setting up instead of
 * rendering four grey boxes.
 */
export default async function StoresPage() {
  const stores = await getStores();

  /**
   * A preview strip per store, all fetched at once.
   *
   * One request per store, in parallel rather than in sequence: this page is
   * rendered on the server and a shop with a dozen stores would otherwise wait
   * for a dozen round trips end to end. Stores with nothing in them are skipped
   * entirely — there is no point asking WordPress for the products of a store
   * that has already told us it has none.
   */
  const previews = await Promise.all(
    stores.map(async (store) => {
      if (store.product_count === 0) return [] as Product[];
      const { products } = await getProductsSafe({
        seller: store.store_slug,
        per_page: PREVIEW_COUNT,
      });
      return products;
    })
  );

  const cards = stores
    .map((store, index) => ({ store, products: previews[index] }))
    .sort((a, b) => b.store.product_count - a.store.product_count);

  const stocked = cards.filter((card) => card.store.product_count > 0).length;

  return (
    // Wider than the shared `InfoPage` shell, which caps at 900px. That width is
    // right for a policy page of running text and wrong for a row of product
    // photographs, so this page carries its own container and mirrors the shell's
    // heading styles rather than fighting them.
    <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 md:px-8 lg:pb-16">
      <nav className="mb-6 flex items-center gap-2 text-[13px] text-shop-muted">
        <Link href="/" className="hover:text-shop-primary">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="text-shop-ink">Shop by store</span>
      </nav>

      <header className="border-b border-shop-line pb-6">
        <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-shop-primary">
          Marketplace
        </p>
        <h1 className="heading-800 text-[24px] text-shop-ink md:text-[30px]">
          Shop by store
        </h1>
        <p className="mt-3 max-w-[65ch] text-[17px] font-medium leading-relaxed text-shop-body">
          Independent Ugandan stores selling through Kandi. Every one is approved before it can
          list a single product, and every order is covered by the same delivery and returns
          promise.
        </p>
        {stores.length > 0 && (
          <p className="mt-3 text-[14px] text-shop-muted">
            {stores.length} {stores.length === 1 ? "store" : "stores"}
            {stocked > 0 && stocked !== stores.length && ` · ${stocked} currently selling`}
          </p>
        )}
      </header>

      <div className="mt-8">
        {stores.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-shop-line bg-white p-10 text-center">
            <p className="text-[17px] font-semibold text-shop-ink">No stores listed yet</p>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-shop-muted">
              We are approving the first marketplace stores now. In the meantime, everything on
              the site is sold and dispatched by Kandi directly.
            </p>
            <Link href="/" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
              Browse all products
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {cards.map(({ store, products }) => (
              <li key={store.id}>
                <StoreCard store={store} products={products} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10">
        <InfoFooterCta
          text="Selling shoes or fashion? Open your own store."
          href="/sell"
          label="Become a seller"
        />
      </div>
    </main>
  );
}

/**
 * One store: who they are on the left, what they sell on the right.
 *
 * A single card rather than a link wrapping everything, because the products
 * inside it are their own destinations. Nesting an `<a>` for a product inside an
 * `<a>` for the store is invalid HTML and browsers resolve it unpredictably —
 * so the card is a plain container and the store name and "Visit store" button
 * are the links to the store.
 */
function StoreCard({ store, products }: { store: Store; products: Product[] }) {
  const href = `/sellers/${store.store_slug}`;
  const empty = store.product_count === 0;

  return (
    <div className="rounded-2xl border border-shop-line bg-white p-4 transition-colors hover:border-shop-primary md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        {/* ---- Identity ---- */}
        <div className="flex min-w-0 items-center gap-3.5 md:w-[260px] md:shrink-0">
          {store.logo ? (
            <Image
              src={store.logo}
              alt=""
              width={56}
              height={56}
              // `unoptimized` because a seller's logo can come from any media
              // library, not only the hosts listed in next.config.
              unoptimized
              className="h-14 w-14 shrink-0 rounded-full border border-shop-hairline object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-shop-primary-soft text-[21px] font-semibold text-shop-primary">
              {store.store_name.charAt(0).toUpperCase()}
            </span>
          )}

          <div className="min-w-0">
            <Link
              href={href}
              className="block truncate text-[17px] font-bold text-shop-ink transition-colors hover:text-shop-primary"
            >
              {store.store_name}
            </Link>
            <p className="mt-0.5 text-[13.5px] text-shop-muted">
              {empty
                ? "Setting up"
                : `${store.product_count} ${store.product_count === 1 ? "product" : "products"}`}
            </p>
            {/* The one credential this marketplace can actually vouch for. Every
                store on the page passed the same approval, and saying so is
                worth more to a first-time shopper than a rating nobody has
                left yet. */}
            <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-shop-success">
              <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
              </svg>
              Approved seller
            </p>
          </div>
        </div>

        {/* ---- What they sell ---- */}
        <div className="min-w-0 flex-1">
          {products.length > 0 ? (
            <ul className="grid grid-cols-4 gap-2.5">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.slug || product.id}`}
                    className="group block"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-shop-line bg-white">
                      {/* Guarded: a product with no photograph stores "" and
                          `next/image` treats an empty src as a request for the
                          current page. */}
                      {product.image && (
                        <Image
                          src={product.image}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 22vw, 150px"
                          className="object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <p className="price mt-1.5 truncate text-[13px] text-shop-ink">
                      {formatPrice(product.price)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-shop-line px-4 py-6 text-center text-[14px] text-shop-muted">
              This store has not listed anything yet.
            </p>
          )}
        </div>

        {/* ---- The way in ---- */}
        <div className="md:shrink-0">
          <Link
            href={href}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-shop-ink px-5 py-2.5 text-[14px] font-bold text-shop-ink transition-colors hover:border-shop-primary hover:text-shop-primary md:w-auto"
          >
            Visit store
            <svg aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
