import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProductReviews, getProductsSafe } from "@/lib/woocommerce";
import {
  absolute,
  breadcrumbJsonLd,
  metaDescription,
  productJsonLd,
  productPath,
  productTitle,
} from "@/lib/seo";
import { formatPrice } from "@/lib/currency";
import { sanitizeHtml } from "@/lib/sanitize-html";
import InfiniteProducts from "@/components/home/InfiniteProducts";
import RecentlyViewed from "@/components/RecentlyViewed";
import ProductViewPing from "@/components/ProductViewPing";
import ReviewSection from "@/components/ReviewSection";
import { getSiteSettings } from "@/lib/site-settings";
import ExpandableContent from "@/components/ExpandableContent";
import ProductPurchase from "./ProductPurchase";
import ProductTabs from "./ProductTabs";

const NEW_WINDOW_DAYS = 30;

/** Kept out of the component body so the clock is not read during render. */
function isNewListing(dateCreated: string | null): boolean {
  if (!dateCreated) return false;
  return (
    Date.now() - new Date(dateCreated).getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
}

/**
 * Per-product metadata.
 *
 * Without this every product shared the site-wide title, which meant Google saw
 * a few dozen pages that looked identical and had no reason to rank any of them
 * — and a link pasted into WhatsApp, the way most Ugandan shoppers share, showed
 * the shop name and no picture.
 *
 * `getProduct` is called here and again in the page. Next dedupes identical
 * fetches within a render, so it is one request, not two.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return { title: "Product not found" };
  }

  const description = metaDescription(product);
  const url = absolute(productPath(product));

  return {
    /**
     * "<name> price in Uganda", not just the name.
     *
     * The layout appends " | Kandi For Less", so the tag reads
     * "Nike Air Max 90 price in Uganda | Kandi For Less" — which matches the
     * shape of what people search for here almost word for word. Ugandan
     * shoppers overwhelmingly search a product with "price in uganda" attached,
     * because the question they are asking is what it costs *landed*, not what
     * it costs in dollars somewhere else.
     *
     * The suffix is dropped when the seller has already put a country or price
     * word in the name, so nothing ends up titled "… in Uganda price in
     * Uganda". Long names are left alone rather than truncated here: Google
     * shortens a title to the width it has, and doing it first only guarantees
     * the loss.
     */
    title: productTitle(product),
    description,
    // Stops the same product counting as duplicate content when it is reachable
    // by both its slug and its numeric id.
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url,
      images: product.image ? [{ url: product.image, alt: product.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: product.image ? [product.image] : undefined,
    },
  };
}

/**
 * The product pages the shop builds ahead of time — and the reason this
 * function exists at all.
 *
 * ---- What was wrong ----
 *
 * Without a `generateStaticParams`, Next renders a dynamic segment on EVERY
 * request. It is not a subtlety of the docs, it is stated outright: "You must
 * always return an array from generateStaticParams, even if it's empty.
 * Otherwise, the route will be dynamically rendered."
 *
 * So the most visited page in the shop — the one every rail, every search
 * result and every shared WhatsApp link points at — was doing a full server
 * render per visit, and each render is four reads from a WordPress host in
 * Uganda: the product, its reviews, the shop's settings and the related rail.
 * A shopper waited for all of that before the first byte of HTML.
 *
 * ---- What this does ----
 *
 * The 60 most popular products are rendered at BUILD time, so a visit to one
 * is a file being served — no WordPress, no render, no wait. The rest are not
 * excluded: `dynamicParams` defaults to true, so a product outside the 60 is
 * rendered the first time somebody asks for it and then cached like the others.
 * The slow render happens once, to one visitor, instead of to all of them.
 *
 * Sixty rather than everything, because each one costs four WordPress requests
 * during the build and the tail of the catalogue does not earn that — the top
 * of a marketplace's catalogue is where nearly all the traffic goes.
 *
 * The params are SLUGS, because that is what the tiles link to
 * (/products/blue-running-shoes). A numeric id still resolves at runtime for
 * older links; those simply are not in the prerendered set.
 *
 * `getProductsSafe` cannot throw, so a WordPress that is unreachable during a
 * build yields an empty list and every product falls back to being rendered on
 * first visit. A slow shop is a worse outcome than a fast one; a build that
 * fails because a shared host was busy is worse than both.
 */
export async function generateStaticParams() {
  const { products } = await getProductsSafe({ per_page: 60, sort: "popular" });

  return products.map((product) => ({
    id: product.slug || String(product.id),
  }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // The segment carries the product's slug — /products/blue-running-shoes —
  // but a numeric id still resolves, so links made before the change (orders,
  // bookmarks, anything already shared) keep working.
  const { id } = await params;
  if (!id) notFound();

  // Fetched on the server, so the page arrives rendered instead of showing a
  // "Loading product…" placeholder while the browser calls back for the data.
  const product = await getProduct(id);
  if (!product) notFound();

  /**
   * Everything else about the page, in one round of requests rather than four.
   *
   * These were four sequential `await`s — reviews, then settings, then the
   * related rail — and every one of them is a trip to WordPress on a shared
   * host. Awaited in a line they add up: the page could not start rendering
   * until the last one came back, and three of the four had been answerable
   * since the moment the product arrived.
   *
   * Only the related rail genuinely depends on the product, and only for its
   * category. So the page is now two stages — resolve the product, then fetch
   * the rest at once — which takes the server's wait from the sum of four
   * requests to the longest of two.
   */
  const brand = product.categories[0];
  const subCategory = product.categories[1];

  const [reviews, settings, relatedResponse] = await Promise.all([
    // Reviews come from WordPress with the page, so they are in the HTML for
    // search engines rather than fetched by the browser afterwards. Keyed on
    // the numeric id the lookup above resolved, since reviews are id-only.
    getProductReviews(product.id),
    // The shop's own terms, so the free-delivery figure beside the buy button
    // is the one the checkout actually charges against.
    getSiteSettings(),
    // 24 rather than 6, and the total page count comes back with them: this
    // feeds the endless "You may also like" grid at the foot of the page rather
    // than a five-tile rail, so the first screenful has to be a full grid and
    // the component needs to know how much more there is to fetch.
    brand
      ? getProductsSafe({ category: brand.slug, per_page: 24 })
      : Promise.resolve({ products: [] as typeof product[], total_pages: 0 }),
  ]);

  /**
   * The ratings split, counted here so the summary beside the price is in the
   * HTML rather than assembled by the browser — it is a search-visible signal
   * as much as a shopper-facing one.
   *
   * Index 0 is five stars, matching the order the bars are drawn in and the
   * tally {@link ReviewSection} keeps further down the page, so the two blocks
   * cannot disagree about the same reviews.
   */
  const ratingBreakdown = [0, 0, 0, 0, 0];
  for (const review of reviews.reviews) {
    const index = 5 - review.rating;
    if (index >= 0 && index < 5) ratingBreakdown[index] += 1;
  }

  // Everything the category returned except this product — no `slice`, because
  // the grid below is endless and the first page should fill it.
  const related = relatedResponse.products.filter((item) => item.id !== product.id);
  const relatedTotalPages =
    (relatedResponse as { total_pages?: number }).total_pages ?? 1;

  const isNew = isNewListing(product.date_created);

  /**
   * The spec table.
   *
   * "Care: Machine washable" and "Occasion: Casual" used to be unconditional
   * rows here, printed on every listing in the catalogue. On a clothing
   * marketplace that is merely filler; on a marketplace that also sells phone
   * chargers, blenders and headphones it is a spec sheet telling shoppers to
   * put electronics in the wash. A shopper who notices one obviously wrong fact
   * has no way to tell which of the others are also invented, and the whole
   * table — including the real WooCommerce attributes above it — stops being
   * read. Both rows are gone rather than made conditional on a category guess:
   * the seller can state care instructions in the description, where they know
   * what the product is.
   *
   * What is left is what the shop can actually stand behind — the product's own
   * attributes, its category, the colour disclaimer, and live stock.
   */
  const detailRows: [string, string][] = [
    ...(product.attributes ?? []).map(
      (attr) =>
        [attr.name, attr.options.map((option) => option.name).join(", ")] as [string, string]
    ),
    brand ? (["Category", brand.name] as [string, string]) : null,
    [
      "Disclaimer",
      "Product color may slightly vary due to photographic lighting sources or your monitor settings.",
    ],
    [
      "Availability",
      product.stock_status === "instock"
        ? product.stock_quantity !== null && product.stock_quantity <= 20
          ? `In stock — only ${product.stock_quantity} left`
          : "In stock"
        : product.stock_status === "onbackorder"
          ? "On backorder"
          : "Sold out",
    ],
  ].filter((row): row is [string, string] => row !== null && Boolean(row[1]));

  // Structured data. This is what turns a plain blue link into a result showing
  // the price, the star rating and "In stock" — the highest-leverage SEO change
  // a new shop can make, because it lifts the click share of the position you
  // already hold rather than needing you to outrank anybody.
  //
  // Every figure comes from WooCommerce. Structured data that disagrees with the
  // visible page is a manual action from Google, not a shortcut.
  //
  // The delivery and returns terms go in with it. Google renders those under
  // the result itself — "Free delivery", "14-day returns" — which answers the
  // two questions that otherwise each cost a click, and both figures come from
  // the same wp-admin settings the checkout charges against, so the markup
  // cannot promise something the basket then refuses.
  const structuredData = [
    productJsonLd(product, {
      terms: {
        freeDeliveryFrom: settings.commerce.free_delivery_from,
        returnsDays: settings.commerce.returns_days,
      },
      reviews: reviews.reviews,
    }),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      ...(brand ? [{ name: brand.name, path: `/category/${brand.slug}` }] : []),
      { name: product.name, path: productPath(product) },
    ]),
  ];

  return (
    /* Tightened throughout.
     *
     * The page was built as a stack of generously separated slabs — 20px above
     * the breadcrumbs, 48px to the tabs, 56px to the reviews — which on a
     * laptop meant a shopper scrolled past whitespace between every section
     * that could have been selling. A product page's job is to keep the buy box
     * and the reasons to use it inside one or two screens; the air between
     * blocks is the first thing that should give way. */
    /* ---- The product page joins the shop's ground ----

       This was a centred column on the plain white page. The storefront and the
       cart both sit on `shop-canvas` now, so a white product page between them
       was the one screen in the buying path still wearing the previous design —
       and it is the screen a shopper spends longest on.

       `<main>` takes the ground and hands the centring to the div inside it: a
       page colour has to reach both edges of the window, and this element is
       capped at the shell, so tinting it directly would have left a white
       margin down each side — exactly the seam the shop asked to have removed
       from the homepage. */
    <main className="pb-20 pt-3 lg:pb-12">
      <div className="mx-auto max-w-[var(--shell)] px-4 md:px-8">
      <script
        type="application/ld+json"
        // The payload is built from our own typed data, never from user input,
        // and JSON.stringify escapes what it contains.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Breadcrumbs */}
      <nav className="mb-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-0.5 text-[13px] text-shop-muted no-scrollbar">
        <Link href="/" className="hover:text-shop-ink">
          Home
        </Link>
        {brand && (
          <>
            <Chevron />
            <Link href={`/category/${brand.slug}`} className="hover:text-shop-ink">
              {brand.name}
            </Link>
          </>
        )}
        {subCategory && (
          <>
            <Chevron />
            <Link href={`/category/${subCategory.slug}`} className="hover:text-shop-ink">
              {subCategory.name}
            </Link>
          </>
        )}
        <Chevron />
        <span className="text-shop-ink">{product.name}</span>
      </nav>

      {/* Records the view for the seller's dashboard. Renders nothing, blocks
          nothing, and counts once per product per tab — see the component. */}
      <ProductViewPing productId={product.id} />

      <ProductPurchase
        product={product}
        isNew={isNew}
        freeDeliveryFrom={settings.commerce.free_delivery_from}
        returnsDays={settings.commerce.returns_days}
        ratingAverage={reviews.average_rating}
        ratingCount={reviews.rating_count}
        ratingBreakdown={ratingBreakdown}
      >
      {/* Nested rather than placed after the row, so it lands in the left
          column under the gallery instead of in a full-width band below a
          column of white. See the grid note in `ProductPurchase`. */}
      <ProductTabs
        tabs={[
          {
            id: "description",
            label: "Description",
            content: (
              /* Collapsed at 200px rather than the component's 320px default.
                 At 320 almost nothing on this catalogue overflowed, so the
                 toggle never appeared and every imported description — spec
                 tables, size charts, supplier boilerplate — ran at full height
                 and pushed the related products and reviews off the screen.
                 200px is about eight lines: enough to judge whether to read
                 on, short enough that the rest of the page stays reachable. */
              <ExpandableContent collapsedHeight={200}>
                <ul className="list-disc pl-5 text-[15px] leading-7 text-shop-body">
                  <li>Style code: KD-{product.id}</li>
                  {product.short_description && <li>{product.short_description}</li>}
                </ul>
                {product.description && (
                  // Imported markup carries its own tables and images, so it is
                  // constrained here: tables scroll rather than widen the page.
                  <div
                    className="mt-4 max-w-3xl text-[15px] leading-7 text-shop-body [&_img]:h-auto [&_img]:max-w-full [&_li]:my-1 [&_p]:my-3 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5"
                    // Run through the allowlist first — see `lib/sanitize-html.ts`.
                    // WordPress applies `wp_kses_post()` before sending this, so
                    // in a healthy deployment nothing is removed here; the
                    // second pass exists so an out-of-date plugin on the server
                    // cannot put script into a shopper's browser.
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                  />
                )}
              </ExpandableContent>
            ),
          },
          {
            id: "details",
            label: "Details & care",
            content: (
              // One column, deliberately. This used to run two-up on wide
              // screens, back when the panel had the full width of the page;
              // it now sits in the left column beside the buy box, and
              // `md:` is a VIEWPORT query — it would still have split a ~580px
              // column into two, putting a 160px label and its value into
              // roughly 130px each.
              <dl className="grid gap-x-12 gap-y-0">
                {detailRows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex gap-4 border-b border-shop-hairline py-3 text-[15px]"
                  >
                    <dt className="w-40 shrink-0 text-shop-muted">{label}</dt>
                    <dd className="text-shop-body">{value}</dd>
                  </div>
                ))}
              </dl>
            ),
          },
          {
            id: "shipping",
            label: "Shipping & returns",
            content: (
              // Stacked for the same reason as the spec list above: three
              // columns of prose inside the left column would be three ~180px
              // ribbons.
              <div className="grid max-w-4xl gap-6 text-[15px] leading-7 text-shop-body">
                <div>
                  <p className="mb-1.5 font-semibold text-shop-ink">Delivery</p>
                  <p>
                    Standard delivery across Uganda takes 1–3 business days
                    {settings.commerce.free_delivery_from > 0 && (
                      <>
                        , and is free on orders over{" "}
                        {formatPrice(settings.commerce.free_delivery_from)}
                      </>
                    )}
                    .
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 font-semibold text-shop-ink">Payment</p>
                  <p>
                    Pay on delivery with cash, MTN Mobile Money or Airtel Money, or by card at
                    checkout.
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 font-semibold text-shop-ink">Returns</p>
                  <p>
                    Returns are accepted within {settings.commerce.returns_days} days of delivery,
                    in original condition with tags attached.
                  </p>
                </div>
              </div>
            ),
          },
        ]}
      />
      </ProductPurchase>

      {/* ---- You may also like ----
           An endless grid rather than the five-tile rail this used to be.

           A rail is the right shape when the page has somewhere else to send the
           shopper. The foot of a product page does not: they have read the
           description, they have read the reviews, and if this item is not the
           one, the only useful thing left is more items. Five of them in a row
           they have to swipe is a smaller answer than the catalogue can give.

           Scoped to this product's own category and seeded with its first page
           on the server, so the grid is full on arrival and indexable, then
           extends as the shopper scrolls. The product being viewed is filtered
           out of every page of it. */}
      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title mb-3 px-1 text-[18px] text-shop-ink md:text-[20px]">
            You may also like
          </h2>
          <InfiniteProducts
            initialProducts={related}
            totalPages={relatedTotalPages}
            category={brand?.slug}
            excludeId={product.id}
          />
        </section>
      )}

      {/* The shopper's own trail back through the products they were weighing
          this one against. It costs nothing to render — the list is already in
          their browser — and it is the cheapest recovery there is for somebody
          about to leave: the item they nearly bought two clicks ago is a better
          recommendation than anything the catalogue can guess at. */}
      <RecentlyViewed />

      <ReviewSection productId={product.id} initial={reviews} />
      </div>
    </main>
  );
}

function Chevron() {
  return (
    <svg className="h-3 w-3 shrink-0 text-shop-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
    </svg>
  );
}
