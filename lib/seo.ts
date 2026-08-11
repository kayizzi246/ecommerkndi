import type { Product, ProductCategory } from "@/lib/woocommerce";

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
 * Product JSON-LD.
 *
 * `aggregateRating` is attached only when real reviews exist — Google requires
 * that the rating be visible on the page, and inventing one to win stars is the
 * fastest way to lose them permanently.
 */
export function productJsonLd(product: Product) {
  const url = absolute(productPath(product));

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: metaDescription(product),
    image: [product.image, ...product.gallery].filter(Boolean).slice(0, 6),
    sku: String(product.id),
    url,
    offers: {
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
    },
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

  return data;
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

export function categoryJsonLd(category: ProductCategory, products: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    url: absolute(`/category/${category.slug}`),
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
