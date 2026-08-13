import type { Product, ProductCategory, ProductReview } from "@/lib/woocommerce";

/**
 * Search-engine plumbing: canonical URLs, and the JSON-LD that turns a plain
 * blue link into a result showing a price, a star rating and "In stock".
 *
 * Those rich results are the single highest-leverage SEO change a new shop can
 * make. They do not improve ranking directly, but they roughly double the click
 * share of the position you already hold — which matters far more in month one,
 * when you rank for your own product names and little else.
 *
 * Everything below is generated from real WooCommerce data. Structured data that
 * disagrees with the page — a rating nobody left, a price that is not the price —
 * is a manual-action risk with Google, not a shortcut.
 */

/**
 * The shop's public origin, for canonical and absolute URLs.
 *
 * Every canonical tag, sitemap entry and Open Graph image on the site is built
 * from this. If it is wrong, the live shop tells Google its pages live at an
 * address nobody can reach — so a production build with no origin configured
 * complains loudly in the log rather than shipping localhost in silence.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  if (process.env.NODE_ENV === "production" && !warnedAboutOrigin) {
    warnedAboutOrigin = true;
    console.warn(
      "[kandi-store] NEXT_PUBLIC_SITE_URL is not set, so canonical URLs and " +
        "sitemap.xml will point at localhost and the site will not be indexed. " +
        "Set it to the shop's public URL, e.g. https://kandiug.com"
    );
  }

  return "http://localhost:3000";
}

/** Warn once per process, not once per rendered page. */
let warnedAboutOrigin = false;

export function absolute(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function productPath(product: Pick<Product, "id" | "slug">): string {
  return `/products/${product.slug || product.id}`;
}

/**
 * A description for the meta tag.
 *
 * Prefers the product's own short description, falls back to a sentence built
 * from what we know. Capped at ~155 characters because Google truncates around
 * there, and a description cut mid-word reads as neglect.
 */
export function metaDescription(product: Product): string {
  const own = product.short_description?.replace(/\s+/g, " ").trim();
  if (own && own.length > 40) {
    return own.length > 155 ? `${own.slice(0, 152).trimEnd()}…` : own;
  }

  const category = product.categories[0]?.name;
  const parts = [
    `Buy ${product.name}`,
    category ? `in ${category}` : "",
    "on KandiUg.",
    product.stock_status === "instock" ? "In stock" : "",
    "Fast delivery across Uganda, pay on delivery.",
  ].filter(Boolean);

  const sentence = parts.join(" ").replace(/\s+/g, " ");
  return sentence.length > 155 ? `${sentence.slice(0, 152).trimEnd()}…` : sentence;
}

/** Google's schema.org availability values. */
function availability(product: Product): string {
  if (product.stock_status === "outofstock") return "https://schema.org/OutOfStock";
  if (product.stock_status === "onbackorder") return "https://schema.org/BackOrder";
  return "https://schema.org/InStock";
}

/**
 * The published commerce terms that Google renders alongside a shopping result.
 *
 * Passed in rather than read here because they live in wp-admin — the same
 * `commerce` block the checkout charges against and the delivery and returns
 * pages quote. Structured data that disagrees with the page it sits on is the
 * one thing this file must never produce, and the only way to guarantee that is
 * for both to read the same number.
 */
export type CommerceTerms = {
  /** Order value above which delivery costs nothing. */
  freeDeliveryFrom: number;
  /** Days a shopper has to change their mind. */
  returnsDays: number;
};

/**
 * How the shop delivers, as an `OfferShippingDetails`.
 *
 * This is what puts a "Free delivery" or "Delivery by Thursday" line under the
 * result itself, which is worth more than it sounds: it answers the two
 * questions that otherwise cost a click each, and Google favours listings that
 * answer them.
 *
 * Free delivery is declared *only* when this product's own price clears the
 * threshold. Claiming it on a 20,000 UGX item because the shop offers free
 * delivery over 50,000 would be an offer the checkout then refuses to honour —
 * the kind of mismatch that loses rich results for the whole domain, not just
 * the page. Below the threshold the rate is omitted rather than guessed, since
 * the real figure depends on the delivery zone the shopper has not picked yet.
 */
function shippingDetails(product: Product, terms: CommerceTerms) {
  const deliversFree = product.price >= terms.freeDeliveryFrom;

  return {
    "@type": "OfferShippingDetails",
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "UG",
    },
    ...(deliversFree
      ? {
          shippingRate: {
            "@type": "MonetaryAmount",
            value: 0,
            currency: "UGX",
          },
        }
      : {}),
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      // Picked and packed same or next day, per the delivery page.
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 1,
        unitCode: "DAY",
      },
      // 1–2 days in and around Kampala, up to 5 upcountry. The range covers
      // both rather than quoting the best case to everyone.
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: 1,
        maxValue: 5,
        unitCode: "DAY",
      },
    },
  };
}

/**
 * The returns policy, as a `MerchantReturnPolicy`.
 *
 * `ReturnFeesCustomerResponsibleForShipping`, not `FreeReturn`: the shop covers
 * the courier when an item is faulty or wrong, and the shopper covers it when
 * they simply changed their mind. The second case is the one this markup
 * describes, because it is the one that applies to an ordinary return — and
 * promising free returns in structured data that the returns page then
 * contradicts is a complaint, a refund and a manual action rather than a sale.
 */
function returnPolicy(terms: CommerceTerms) {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "UG",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: terms.returnsDays,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibleForShipping",
  };
}

/**
 * Product JSON-LD.
 *
 * `aggregateRating` is attached only when real reviews exist — Google requires
 * that the rating be visible on the page, and inventing one to win stars is the
 * fastest way to lose them permanently.
 *
 * @param options.terms   Delivery and returns terms, so the result can carry
 *                        them. Omitted on listing pages, where the offer block
 *                        is a summary rather than the page's main entity.
 * @param options.reviews The reviews rendered on the page, for review snippets.
 */
export function productJsonLd(
  product: Product,
  options: { terms?: CommerceTerms; reviews?: ProductReview[] } = {}
) {
  const url = absolute(productPath(product));

  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url,
    priceCurrency: "UGX",
    price: product.price,
    availability: availability(product),
    itemCondition: "https://schema.org/NewCondition",
    seller: {
      "@type": "Organization",
      name: product.seller?.store_name || "KandiUg",
    },
  };

  // Google warns about an offer with no expiry and, for a sale price, treats a
  // missing one as a reason to distrust the figure. A year out is the honest
  // answer for a shop that reprices continuously: the price is good until we
  // say otherwise, and the hourly sitemap and 15-second cache mean a change
  // reaches Google long before this lapses.
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  offer.priceValidUntil = validUntil.toISOString().slice(0, 10);

  if (options.terms) {
    offer.shippingDetails = shippingDetails(product, options.terms);
    offer.hasMerchantReturnPolicy = returnPolicy(options.terms);
  }

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: metaDescription(product),
    image: [product.image, ...product.gallery].filter(Boolean).slice(0, 6),
    sku: String(product.id),
    url,
    offers: offer,
  };

  if (product.categories[0]) {
    data.category = product.categories[0].name;
  }

  if (product.rating_count > 0 && product.average_rating > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.average_rating,
      reviewCount: product.rating_count,
    };
  }

  // Individual reviews, so a result can quote a shopper rather than only
  // showing a number of stars. Capped at five: Google reads no more than that
  // for a snippet, and the rest is weight on every page load for nothing.
  //
  // Only reviews with something written in them — a bare five-star rating with
  // no text produces an empty quote in the SERP, which reads worse than none.
  const written = (options.reviews ?? []).filter((review) => review.text?.trim());
  if (written.length > 0) {
    data.review = written.slice(0, 5).map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.author },
      datePublished: review.date?.slice(0, 10),
      reviewBody: review.text.replace(/<[^>]*>/g, "").trim(),
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
    }));
  }

  return data;
}

/**
 * FAQ JSON-LD.
 *
 * Earns the expandable question list under a result — several times the
 * vertical space of a plain link, on a page that costs nothing extra to write
 * because the questions are already there.
 *
 * Google only honours this when the questions and answers are visible on the
 * page, so it takes the same array the page renders rather than a second copy
 * that could drift out of step with it.
 */
export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

/** Breadcrumb JSON-LD, so results show Home › Category › Product. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.path),
    })),
  };
}

/**
 * Site-level JSON-LD: who the shop is, and the search box Google can render
 * under the homepage result once the domain has enough authority.
 */
export function siteJsonLd(brandName: string) {
  const url = siteUrl();

  return [
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      name: brandName,
      url,
      areaServed: "UG",
      currenciesAccepted: "UGX",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: brandName,
      url,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${url}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/**
 * A listing page and the products on it, as a `CollectionPage` + `ItemList`.
 *
 * Tells Google that a page is a list of specific products rather than one long
 * document that happens to mention prices — which is what decides whether the
 * individual products get discovered and carried into Shopping surfaces, or
 * whether the page ranks alone as a wall of text.
 *
 * Capped at 20: past that Google stops reading, and the payload is being
 * shipped to every visitor as well as every crawler.
 */
export function collectionJsonLd(
  name: string,
  path: string,
  products: Product[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: absolute(path),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 20).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absolute(productPath(product)),
        name: product.name,
      })),
    },
  };
}

export function categoryJsonLd(category: ProductCategory, products: Product[]) {
  return collectionJsonLd(category.name, `/category/${category.slug}`, products);
}
