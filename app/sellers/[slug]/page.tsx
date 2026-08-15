import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductsSafe, getStores } from "@/lib/woocommerce";
import { absolute, breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { formatPrice } from "@/lib/currency";
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
    // A store page is a real landing page — someone searching a shop by name
    // should find it — so it is canonical to itself rather than inheriting.
    alternates: { canonical: `/sellers/${slug}` },
  };
}

/** "Selling here since March 2026", from the seller's own registration date. */
function since(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Everything one marketplace store sells, filtered server-side by slug. */
export default async function StorePage({ params }: Params) {
  const { slug } = await params;

  // Both at once. The product filter is keyed on the slug from the URL, not on
  // anything the store directory tells us, so waiting for one before starting
  // the other spent a whole WordPress round trip for nothing.
  const [stores, listing] = await Promise.all([
    getStores(),
    getProductsSafe({ seller: slug, per_page: 48 }),
  ]);

  const store = stores.find((entry) => entry.store_slug === slug);
  if (!store) notFound();

  const { products } = listing;

  /**
   * Figures the header states, all counted from what is actually on the page.
   *
   * The header used to carry one number — the product count — and a green
   * "Approved store" pill. A shopper who has landed on a store they have never
   * heard of is asking whether it is worth buying from, and neither of those
   * answers it. What does: how much stock there is, what the cheapest thing
   * costs, whether anything is reduced, and how long they have been trading.
   */
  const inStock = products.filter((product) => product.stock_status !== "outofstock");
  const onSale = products.filter((product) => product.on_sale).length;
  const prices = inStock.map((product) => product.price).filter((price) => price > 0);
  const from = prices.length > 0 ? Math.min(...prices) : 0;
  const trading = since(store.since);

  const stats = [
    { label: "Listings", value: String(store.product_count) },
    ...(from > 0 ? [{ label: "From", value: formatPrice(from) }] : []),
    ...(onSale > 0 ? [{ label: "On offer", value: String(onSale) }] : []),
    ...(trading ? [{ label: "Selling since", value: trading }] : []),
  ];

  return (
    <main className="w-full px-0 pb-24 pt-4 md:px-8 lg:pb-16">
      {/* A store page ranks for the store's own name — often how a seller's
          existing customers look for them — so it says what it is in the form
          Google reads, and names its products rather than leaving them to be
          discovered as words in a page. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Shop by store", path: "/sellers" },
              { name: store.store_name, path: `/sellers/${slug}` },
            ]),
            collectionJsonLd(store.store_name, `/sellers/${slug}`, products),
            {
              "@context": "https://schema.org",
              "@type": "Store",
              name: store.store_name,
              url: absolute(`/sellers/${slug}`),
              ...(store.logo ? { image: store.logo } : {}),
              areaServed: "UG",
            },
          ]),
        }}
      />

      <nav className="mb-4 flex items-center gap-2 px-3 text-[13px] text-shop-muted md:px-0">
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

      {/* ---- Store header ----
           A tinted band rather than a white card in a white page. It is the one
           piece of chrome on the route and it has a job: to say, in the second
           before a shopper starts scanning photographs, whose shop this is and
           whether it is a real one. The tint fades to white before the grid, so
           nothing coloured sits behind a product. */}
      <header className="overflow-hidden bg-gradient-to-b from-shop-primary-soft via-white to-white px-3 pb-5 pt-6 md:rounded-2xl md:px-7 md:pb-7">
        <div className="flex flex-wrap items-start gap-4">
          {store.logo ? (
            <Image
              src={store.logo}
              alt=""
              width={80}
              height={80}
              unoptimized
              className="h-[68px] w-[68px] shrink-0 rounded-full bg-white object-cover shadow-sm ring-1 ring-black/5 md:h-20 md:w-20"
            />
          ) : (
            <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-white text-[26px] font-bold text-shop-primary shadow-sm ring-1 ring-black/5 md:h-20 md:w-20 md:text-[30px]">
              {store.store_name.charAt(0).toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="heading-black text-[24px] leading-tight text-shop-ink md:text-[30px]">
                {store.store_name}
              </h1>
              {/* The tick, not a pill of text. Every store on this site is an
                  approved store — a badge every page wears says nothing — but
                  the mark next to the name is still the shorthand a shopper
                  reads for "checked", so it stays as one small green mark with
                  the claim spelled out beside it. */}
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-shop-success">
                <svg aria-hidden className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 1.5l2.1 1.4 2.5-.3 1 2.3 2.1 1.4-.7 2.4.7 2.4-2.1 1.4-1 2.3-2.5-.3L10 18.5l-2.1-1.4-2.5.3-1-2.3L2.3 13l.7-2.4L2.3 8.2l2.1-1.4 1-2.3 2.5.3L10 1.5Zm3.5 6.1-4.4 4.6-2.2-2.1-1.1 1.2 3.3 3.2 5.5-5.7-1.1-1.2Z"
                    clipRule="evenodd"
                  />
                </svg>
                Vetted seller
              </span>
            </div>

            <p className="mt-1 text-[14.5px] text-shop-body">
              Sold by {store.store_name}, dispatched and guaranteed through Kandi.
            </p>

            {/* The figures, as a row of small facts rather than a sentence.
                Each one is counted from the catalogue above, so none of them can
                be true on the day it was written and wrong afterwards. */}
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-shop-muted">
                    {stat.label}
                  </dt>
                  <dd className="price mt-0.5 text-[16px] text-shop-ink">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </header>

      {products.length === 0 ? (
        <div className="mx-3 mt-8 rounded-2xl border border-dashed border-shop-line bg-white p-10 text-center md:mx-0">
          <p className="text-[16px] text-shop-muted">
            This store has nothing listed right now. Check back soon.
          </p>
          <Link href="/sellers" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
            Browse other stores
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mb-3 mt-7 px-3 text-[16px] font-bold text-shop-ink md:px-0 md:text-[18px]">
            Everything from this store
            <span className="ml-2 text-[14px] font-normal text-shop-muted">
              {products.length} {products.length === 1 ? "item" : "items"}
            </span>
          </h2>

          {/* The same grid as every other listing on the site. A store page that
              invented its own columns and its own gutters would make the
              identical product look like a different object here. */}
          {/* Seven across on a wide screen, up from six.

              The tiles are chrome-free and their text block is a fixed four
              rows, so they lose nothing by being narrower — at 1440px seven
              still leaves each photograph around 180px, comfortably above the
              point where a product stops being recognisable. What it buys is a
              row that reads as a catalogue rather than a shelf: more of the
              store is above the fold, which on a page whose entire job is
              "here is everything this seller has" is the whole point. */}
          <div className="grid grid-cols-2 gap-x-px gap-y-1 sm:grid-cols-3 sm:gap-y-2 lg:grid-cols-5 xl:grid-cols-7">
            {products.map((product) => (
              /* `sizes` stated rather than defaulted. The card's default
                 describes the six-column grids elsewhere in the shop and ends
                 at 17vw; this grid is seven across above 1280px, so a tile is
                 nearer 14vw and the default would have every photograph on the
                 page fetched about 20% larger than it can ever be shown. */
              <ProductCard
                key={product.id}
                product={product}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 20vw, 14vw"
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
