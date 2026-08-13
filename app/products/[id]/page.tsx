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
} from "@/lib/seo";
import { formatPrice } from "@/lib/currency";
import ProductCarousel from "@/components/ProductCarousel";
import RecentlyViewed from "@/components/RecentlyViewed";
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
    title: product.name,
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

  // Reviews come from WordPress with the page, so they are in the HTML for
  // search engines rather than fetched by the browser afterwards. Keyed on the
  // numeric id the lookup above resolved, since reviews are id-only.
  const reviews = await getProductReviews(product.id);

  // The shop's own terms, so the free-delivery figure beside the buy button is
  // the one the checkout actually charges against.
  const settings = await getSiteSettings();

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

  const brand = product.categories[0];
  const subCategory = product.categories[1];

  const relatedResponse = brand
    ? await getProductsSafe({ category: brand.slug, per_page: 6 })
    : { products: [] };
  const related = relatedResponse.products
    .filter((item) => item.id !== product.id)
    .slice(0, 5);

  const isNew = isNewListing(product.date_created);

  const detailRows: [string, string][] = [
    ...(product.attributes ?? []).map(
      (attr) =>
        [attr.name, attr.options.map((option) => option.name).join(", ")] as [string, string]
    ),
    ["Care", "Machine washable"],
    brand ? (["Ideal For", brand.name] as [string, string]) : null,
    [
      "Disclaimer",
      "Product color may slightly vary due to photographic lighting sources or your monitor settings.",
    ],
    ["Occasion", "Casual"],
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
    <main className="mx-auto max-w-[1600px] px-4 pb-20 pt-3 md:px-8 lg:pb-12">
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

      <ProductPurchase
        product={product}
        isNew={isNew}
        freeDeliveryFrom={settings.commerce.free_delivery_from}
        ratingAverage={reviews.average_rating}
        ratingCount={reviews.rating_count}
        ratingBreakdown={ratingBreakdown}
      />

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
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                )}
              </ExpandableContent>
            ),
          },
          {
            id: "details",
            label: "Details & care",
            content: (
              // Two columns on wide screens, so the spec list stops being a
              // long vertical scroll.
              <dl className="grid gap-x-12 gap-y-0 md:grid-cols-2">
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
              <div className="grid max-w-4xl gap-8 text-[15px] leading-7 text-shop-body md:grid-cols-3">
                <div>
                  <p className="mb-1.5 font-semibold text-shop-ink">Delivery</p>
                  <p>
                    Standard delivery across Uganda takes 1–3 business days, and is free on orders
                    over {formatPrice(50000)}.
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
                    Returns are accepted within 14 days of delivery, in original condition with tags
                    attached.
                  </p>
                </div>
              </div>
            ),
          },
        ]}
      />

      <ProductCarousel title="You may also like" products={related} />

      {/* The shopper's own trail back through the products they were weighing
          this one against. It costs nothing to render — the list is already in
          their browser — and it is the cheapest recovery there is for somebody
          about to leave: the item they nearly bought two clicks ago is a better
          recommendation than anything the catalogue can guess at. */}
      <RecentlyViewed />

      <ReviewSection productId={product.id} initial={reviews} />
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
