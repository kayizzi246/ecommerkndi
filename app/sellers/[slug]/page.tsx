import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductsSafe, getStores } from "@/lib/woocommerce";
import { absolute, breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { formatPrice } from "@/lib/currency";
import ProductCard from "@/components/ProductCard";
import { PRODUCT_GRID } from "@/lib/product-grid";

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
/**
 * Every store page, built ahead of time.
 *
 * The whole point is the first line of the Next docs on this function: a
 * dynamic segment with no `generateStaticParams` is rendered on EVERY request.
 * Without this, each visit to a store front re-fetched the store directory and
 * the store's products from WordPress before a byte of HTML went out.
 *
 * The full list rather than a slice, unlike /products/[id]: there are as many
 * of these as the shop has sellers, which is a number in the tens, and a seller
 * looking at their own store front is one of the people most likely to judge
 * the shop by how fast it is.
 *
 * `getStores` returns [] on an older WordPress plugin, which yields an empty
 * array here — every store then renders on first visit and is cached from
 * there. A slower first paint is a better failure than a build that stops.
 */
export async function generateStaticParams() {
  const stores = await getStores();

  return stores.map((store) => ({ slug: store.store_slug }));
}

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
    /* No horizontal padding on the page itself. The route is full-width now,
       and the dark header has to reach both edges of the window — a masthead
       inset by 12px is a card pretending to be a masthead. Each block below
       carries its own gutter instead. */
    <main className="w-full pb-24 lg:pb-16">
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

      {/* The visible breadcrumb is gone. It named a path nobody took: a store
          link is shared by the seller and arrives from WhatsApp, from a bio,
          from a printed card — almost never from the store index it pointed
          back to. What it cost was the first line of the page, which now goes
          to the store's own name.

          `breadcrumbJsonLd` above is untouched. That trail is for Google, which
          uses it to render the path under a search result, and it is true
          whether or not it is drawn. */}

      {/* ---- Store header ----

           A dark band, where this was a peach gradient fading to white.

           The peach was the same wash the homepage campaign panel and the
           account box already wear, so the one page on the site that belongs to
           somebody else looked like another Kandi shelf. Ink is the opposite
           claim: it reads as a masthead for THIS shop, it lets the store's own
           name be the brightest thing on the page, and it puts a hard edge
           between the header and the catalogue instead of a gradient dissolving
           into it.

           It is also the only place a shopper meets a store's identity, so it
           can afford to be the one heavy block on the route — the grid beneath
           is white and chrome-free and stays that way. */}
      <header className="overflow-hidden bg-[#1c1a18] px-4 pb-6 pt-7 text-white md:px-8 md:pb-8 md:pt-9">
        <div className="flex flex-wrap items-start gap-4">
          {store.logo ? (
            <Image
              src={store.logo}
              alt=""
              width={80}
              height={80}
              unoptimized
              className="h-[68px] w-[68px] shrink-0 rounded-full bg-white object-cover ring-1 ring-white/15 md:h-[88px] md:w-[88px]"
            />
          ) : (
            <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-white text-[26px] font-bold text-shop-primary ring-1 ring-white/15 md:h-[88px] md:w-[88px] md:text-[34px]">
              {store.store_name.charAt(0).toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {/* Bigger, and tighter. A store name is the one string on this
                  page that has to carry weight on its own, and `tracking-tight`
                  at this size is what stops a two-word name reading as two
                  separate words. */}
              <h1 className="heading-black text-[28px] leading-[1.1] tracking-tight text-white md:text-[38px]">
                {store.store_name}
              </h1>
              {/* The tick, not a pill of text. Every store on this site is an
                  approved store — a badge every page wears says nothing — but
                  the mark next to the name is still the shorthand a shopper
                  reads for "checked", so it stays as one small green mark with
                  the claim spelled out beside it. */}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12.5px] font-semibold text-[#5fd08a]">
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

            <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-white/70">
              Sold by {store.store_name}, dispatched and guaranteed through Kandi.
            </p>

            {/* The figures, as a row of small facts rather than a sentence.
                Each one is counted from the catalogue above, so none of them can
                be true on the day it was written and wrong afterwards. */}
            {/* Separated by rules rather than by air. Four numbers spaced out
                across a dark band read as four unrelated facts; divided, they
                read as one specification — which is what they are, and what
                makes a store look like a business rather than a page. */}
            <dl className="mt-5 flex flex-wrap items-stretch gap-x-6 gap-y-4">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={index > 0 ? "border-l border-white/15 pl-6" : ""}
                >
                  <dt className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/45">
                    {stat.label}
                  </dt>
                  <dd className="price mt-1 text-[17px] text-white md:text-[19px]">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </header>

      {products.length === 0 ? (
        <div className="mx-3 mt-8 rounded-2xl border border-dashed border-shop-line bg-white p-10 text-center md:mx-8">
          <p className="text-[16px] text-shop-muted">
            This store has nothing listed right now. Check back soon.
          </p>
          <Link href="/sellers" className="btn-shop mt-5 inline-flex px-8 py-3 text-[15px]">
            Browse other stores
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mb-4 mt-8 flex flex-wrap items-baseline gap-x-3 px-3 text-[19px] font-extrabold tracking-tight text-shop-ink md:px-8 md:text-[22px]">
            Everything from this store
            <span className="text-[13.5px] font-medium tracking-normal text-shop-muted">
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
          {/* 8/16 on a phone, 12/24 from sm — the shared product-grid rhythm.
              See the note in the category grid. */}
          {/* One more column than every other listing. This route is
              full-width and its entire job is "here is everything this seller
              has", so the extra column puts noticeably more of the store above
              the fold. It tracks the shared grid rather than sitting at a fixed
              number — that grid dropped to five at xl, so this is six, and the
              cards here stay the same width as the cards everywhere else. */}
          <div className={`px-3 md:px-8 ${PRODUCT_GRID} 2xl:grid-cols-6`}>
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
