export type ProductCategory = {
  id: number;
  name: string;
  slug: string;
  count?: number;
  /** 0 for a top-level department; otherwise the parent term id. */
  parent?: number;
  /** Optional promo tile used in the mega menu. */
  image?: string | null;
};

/** A top-level department with its child categories, for the mega menu. */
export type CategoryNode = ProductCategory & { children: ProductCategory[] };

/**
 * Groups the flat category list from WordPress into departments and their
 * children. Categories whose parent is missing from the list are promoted to
 * top level so nothing silently disappears from the nav.
 */
export function buildCategoryTree(categories: ProductCategory[]): CategoryNode[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const nodes = new Map<number, CategoryNode>();

  for (const category of categories) {
    const parentId = category.parent ?? 0;
    if (parentId === 0 || !byId.has(parentId)) {
      nodes.set(category.id, { ...category, children: [] });
    }
  }

  for (const category of categories) {
    const parentId = category.parent ?? 0;
    if (parentId !== 0 && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(category);
    }
  }

  return [...nodes.values()].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}

export type ProductAttributeOption = {
  name: string;
  value?: string;
  image?: string;
};

export type ProductAttribute = {
  name: string;
  options: ProductAttributeOption[];
};

export type ProductVariation = {
  attributes: Record<string, string>;
  is_in_stock: boolean;
};

/** The marketplace store that owns a listing, when the Seller Centre plugin is active. */
export type ProductSeller = {
  id: number;
  store_name: string;
  store_slug: string;
  logo?: string;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  price: number;
  regular_price: number;
  sale_price: number | null;
  on_sale: boolean;
  featured: boolean;
  stock_status: "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  image: string;
  gallery: string[];
  date_created: string | null;
  short_description: string;
  categories: ProductCategory[];
  attributes: ProductAttribute[];
  variations?: ProductVariation[];
  description?: string;
  seller?: ProductSeller;
  /** WooCommerce's own review average, 0 when nobody has reviewed yet. */
  average_rating: number;
  rating_count: number;
  /** Lifetime units sold, from WooCommerce — the "N sold" line on a tile. */
  total_sales: number;
};

export type ProductListResponse = {
  products: Product[];
  total: number;
  total_pages: number;
};

export type ProductQuery = {
  page?: number;
  per_page?: number;
  category?: string;
  search?: string;
  on_sale?: boolean;
  featured?: boolean;
  /** Marketplace store slug, for the per-store listing pages. */
  seller?: string;
};

/** A marketplace store, as shown in the public directory. */
export type Store = {
  id: number;
  store_name: string;
  store_slug: string;
  logo: string;
  product_count: number;
  since: string;
};

/**
 * How long a product read is reused before the shop asks WordPress again.
 *
 * Short on purpose. A minute was long enough that a product deleted in wp-admin
 * kept appearing on the shop, which is confusing in a way that being a few
 * hundred milliseconds slower is not. WordPress also pushes a purge on every
 * product change (see kandi-storefront-settings.php), so this window is only
 * the fallback for when that push cannot get through.
 */
const REVALIDATE_SECONDS = 15;

/**
 * The storefront's own public URL, sent to WordPress on every request so the
 * plugin can learn where to push cache purges without anybody typing it in.
 *
 * Vercel sets these automatically, so a normal deployment configures itself.
 */
function storefrontOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "";
}

/**
 * Cache tag on every WordPress read.
 *
 * The minute-long window above is what makes the shop fast, but it is also why
 * a product added or deleted in the admin used to keep showing its old self for
 * up to a minute. Tagging the reads lets a write clear them the moment it
 * happens (see app/api/owner/[...path]/route.ts) instead of waiting the window
 * out. Kept in step with PRODUCTS_TAG in lib/owner-server.ts.
 */
const PRODUCTS_TAG = "kandi-products";

function baseUrl(): string {
  const url = process.env.WP_API_URL;
  if (!url) {
    throw new Error(
      "WP_API_URL is not set. Add it to .env.local, e.g. WP_API_URL=https://yourwordpresssite.com/wp-json/kandi/v1"
    );
  }
  return url.replace(/\/$/, "");
}

function storeApiBaseUrl(): string {
  const url = baseUrl().replace(/\/$/, "");
  const wpJsonMatch = url.match(/^(.*\/wp-json)(?:\/[^/]+)?$/i);
  return wpJsonMatch ? `${wpJsonMatch[1]}/wc/store/v1` : `${url}/wc/store/v1`;
}

function getCandidateUrls(path: string, fallbackPath?: string): string[] {
  const bust = (url: string) =>
    `${url}${url.includes("?") ? "&" : "?"}_cb=${cacheBuster()}`;

  const customUrl = bust(`${baseUrl()}${path}`);
  if (!fallbackPath) {
    return [customUrl];
  }

  return [customUrl, bust(`${storeApiBaseUrl()}${fallbackPath}`)];
}

/**
 * A value that changes once per cache window, appended to every product URL.
 *
 * This exists because of a real incident: a page cache on the WordPress host was
 * storing `/wp-json/kandi/v1/products?per_page=18` and replaying it for hours,
 * so products deleted in wp-admin stayed on the shop no matter what this app
 * did. The tell was that the identical endpoint answered correctly on a query
 * string nobody had requested before.
 *
 * Rotating a parameter means the origin cache can never hold a response for
 * longer than our own window. It costs nothing here: the Next.js cache entry
 * expires after exactly the same interval, so the key was going to change
 * anyway.
 *
 * The proper fix is the `no-store` headers in kandi-store-api.php. This is the
 * belt to that pair of braces, and it works even on a host whose cache ignores
 * them.
 */
function cacheBuster(): number {
  return Math.floor(Date.now() / (REVALIDATE_SECONDS * 1000));
}

async function wpFetchRaw(path: string, fallbackPath?: string): Promise<unknown | null> {
  const urls = getCandidateUrls(path, fallbackPath);
  let lastStatus = 0;

  for (const url of urls) {
    const origin = storefrontOrigin();

    const res = await fetch(url, {
      // The plugin reads this header and remembers it, which is how the shop
      // registers itself for cache purges with no setup step.
      headers: origin ? { "X-Kandi-Storefront": origin } : undefined,
      next: { revalidate: REVALIDATE_SECONDS, tags: [PRODUCTS_TAG] },
    });

    if (res.ok) {
      return res.json();
    }

    if ([404, 405, 500, 401, 403].includes(res.status)) {
      lastStatus = res.status;
      continue;
    }

    throw new Error(`WordPress request failed (${res.status}): ${path}`);
  }

  if (lastStatus) {
    console.warn(`[kandi-store] WordPress request failed (${lastStatus}): ${path}`);
  }

  return null;
}

/* --------------------------------------------------------------- JSON readers
 *
 * Two different WordPress endpoints feed the mappers below — the kandi/v1
 * plugin and, when it is not installed, the WooCommerce Store API — and the two
 * disagree about names, nesting and whether a number arrives as a number or a
 * string. None of it is typed at the boundary, so these four readers do the
 * narrowing in one place: anything unexpected becomes the fallback rather than
 * an `undefined` that surfaces three components later as a blank price.
 */

/** A JSON object from WordPress, before anything has been proven about it. */
type RawJson = Record<string, unknown>;

function obj(value: unknown): RawJson {
  return typeof value === "object" && value !== null ? (value as RawJson) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Coerces to a finite number — WooCommerce sends prices as strings. */
function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toProduct(raw: unknown): Product {
  const product = obj(raw);
  const prices = obj(product.prices);
  const price = num(prices.price ?? product.price);
  const regularPrice = num(prices.regular_price ?? prices.price ?? product.regular_price, price);
  const rawSale = prices.sale_price ?? product.sale_price;
  const salePrice = rawSale == null ? null : num(rawSale);
  const onSale = salePrice != null && regularPrice > 0 && salePrice < regularPrice;

  const categories = arr(product.categories).map((entry) => {
    const category = obj(entry);
    return {
      id: num(category.id),
      name: str(category.name),
      slug: str(category.slug),
      count: category.count == null ? undefined : num(category.count),
    };
  });

  // Two payload shapes reach this mapper and they name their images
  // differently, so both are normalised here:
  //   • the kandi/v1 endpoint sends `image` (string) + `gallery` (string[])
  //   • the WooCommerce Store API fallback sends `images` ({ src }[])
  // Reading only one shape is why gallery thumbnails never appeared.
  const toSrc = (entry: unknown): string => {
    if (typeof entry === "string") return entry;
    const image = obj(entry);
    return str(image.src) || str(image.url);
  };

  const storeApiImages = arr(product.images).map(toSrc).filter(Boolean);
  const customGallery = arr(product.gallery).map(toSrc).filter(Boolean);

  const mainImage: string = toSrc(product.image) || storeApiImages[0] || customGallery[0] || "";

  // Every other shot, main image excluded and duplicates dropped — the product
  // page prepends the main image itself.
  const gallery = [...storeApiImages, ...customGallery].filter(
    (src, index, all) => src !== mainImage && all.indexOf(src) === index
  );

  const seller = obj(product.seller);

  return {
    id: num(product.id),
    name: str(product.name),
    slug: str(product.slug),
    price,
    regular_price: regularPrice,
    sale_price: salePrice,
    on_sale: Boolean(product.on_sale ?? onSale),
    featured: Boolean(product.featured),
    stock_status: str(product.stock_status, "outofstock") as Product["stock_status"],
    stock_quantity: product.stock_quantity == null ? null : num(product.stock_quantity),
    image: mainImage,
    gallery,
    date_created: str(product.date_created) || null,
    short_description: str(product.short_description ?? product.shortDescription),
    categories,
    attributes: arr(product.attributes).map((entry) => {
      const attribute = obj(entry);
      return {
        name: str(attribute.name),
        options: arr(attribute.options).map((raw_option) => {
          if (typeof raw_option === "string") return { name: raw_option };
          const option = obj(raw_option);
          return {
            name: str(option.name) || str(option.label),
            value: option.value == null ? undefined : str(option.value),
            image: str(option.image) || str(option.image_url) || undefined,
          };
        }),
      };
    }),
    variations: Array.isArray(product.variations)
      ? product.variations.map((entry) => {
          const variation = obj(entry);
          return {
            attributes: obj(variation.attributes) as Record<string, string>,
            is_in_stock: Boolean(variation.is_in_stock ?? variation.in_stock),
          };
        })
      : undefined,
    // The Store API fallback nests the average under `average_rating` too, but
    // sends it as a string; both shapes coerce cleanly.
    average_rating: num(product.average_rating),
    rating_count: num(product.rating_count ?? product.review_count),
    total_sales: num(product.total_sales),
    description: product.description == null ? undefined : str(product.description),
    seller: product.seller
      ? {
          id: num(seller.id),
          store_name: str(seller.store_name),
          store_slug: str(seller.store_slug),
          logo: str(seller.logo) || undefined,
        }
      : undefined,
  };
}

function toCategory(raw: unknown): ProductCategory {
  const category = obj(raw);
  return {
    id: num(category.id),
    name: str(category.name),
    slug: str(category.slug),
    count: category.count == null ? undefined : num(category.count),
    parent: category.parent == null ? 0 : num(category.parent),
    // A category image arrives either as a URL or as WooCommerce's `{ src }`
    // object; the old reader only ever produced the first, because `??` stopped
    // at the object and handed it on as a category image React could not render.
    image: typeof category.image === "string" ? category.image : str(obj(category.image).src) || null,
  };
}

export async function getProducts(
  query: ProductQuery = {}
): Promise<ProductListResponse> {
  try {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.per_page) params.set("per_page", String(query.per_page));
    if (query.category) params.set("category", query.category);
    if (query.search) params.set("search", query.search);
    if (query.on_sale) params.set("on_sale", "1");
    if (query.featured) params.set("featured", "1");
    if (query.seller) params.set("seller", query.seller);

    const qs = params.toString();
    const path = `/products${qs ? `?${qs}` : ""}`;
    const raw = await wpFetchRaw(path, path);

    if (!raw) {
      return { products: [], total: 0, total_pages: 0 };
    }

    const payload = (Array.isArray(raw) ? { products: raw } : raw) as Partial<ProductListResponse>;
    const products = Array.isArray(payload?.products) ? payload.products : [];

    return {
      products: products.map(toProduct),
      total: Number(payload?.total ?? products.length ?? 0),
      total_pages: Number(payload?.total_pages ?? 1),
    };
  } catch (error) {
    console.error("[kandi-store] getProducts failed:", error);
    return { products: [], total: 0, total_pages: 0 };
  }
}

/** Same as getProducts but returns an empty list instead of throwing, so the
 * homepage still renders while WordPress is unreachable or not yet configured. */
export async function getProductsSafe(
  query: ProductQuery = {}
): Promise<ProductListResponse> {
  try {
    return await getProducts(query);
  } catch (error) {
    console.error("[kandi-store] getProducts failed:", error);
    return { products: [], total: 0, total_pages: 0 };
  }
}

/**
 * One product, by numeric id or by slug.
 *
 * Product URLs read `/products/blue-running-shoes` rather than `/products/190`
 * — a link somebody can read before clicking, and the form search engines index
 * on. Numeric ids still resolve, so every order, bookmark and shared link made
 * before the change keeps working.
 *
 * The Store API fallback only understands ids, so a slug lookup that has to fall
 * through skips it rather than requesting a URL that cannot answer.
 */
export async function getProduct(idOrSlug: string | number): Promise<Product | null> {
  const key = String(idOrSlug);
  const numeric = /^\d+$/.test(key);

  try {
    const raw = await wpFetchRaw(
      `/products/${encodeURIComponent(key)}`,
      numeric ? `/products/${key}` : undefined
    );
    if (!raw) {
      return null;
    }
    return toProduct(raw);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- reviews */

export type ProductReview = {
  id: number;
  author: string;
  avatar: string;
  rating: number;
  /** ISO date string. */
  date: string;
  text: string;
  verified: boolean;
};

export type ProductReviews = {
  reviews: ProductReview[];
  average_rating: number;
  rating_count: number;
  /** Approved reviews per star, keyed "1".."5". */
  breakdown: Record<string, number>;
};

const EMPTY_REVIEWS: ProductReviews = {
  reviews: [],
  average_rating: 0,
  rating_count: 0,
  breakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
};

function toReview(raw: unknown): ProductReview {
  const review = (raw ?? {}) as Record<string, unknown>;
  return {
    id: Number(review.id ?? 0),
    author: String(review.author ?? "Shopper"),
    avatar: String(review.avatar ?? ""),
    rating: Number(review.rating ?? 0) || 0,
    date: String(review.date ?? ""),
    text: String(review.text ?? ""),
    verified: Boolean(review.verified),
  };
}

export function normaliseReviews(raw: unknown): ProductReviews {
  const payload = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(payload.reviews) ? payload.reviews : [];
  const breakdown = { ...EMPTY_REVIEWS.breakdown };

  for (const [star, count] of Object.entries(
    (payload.breakdown as Record<string, unknown>) ?? {}
  )) {
    if (star in breakdown) breakdown[star] = Number(count) || 0;
  }

  return {
    reviews: list.map(toReview),
    average_rating: Number(payload.average_rating ?? 0) || 0,
    rating_count: Number(payload.rating_count ?? list.length) || 0,
    breakdown,
  };
}

/**
 * Reviews for one product, straight from WordPress. Never throws: a product
 * page with an unreachable backend shows an empty review section rather than a
 * 500.
 */
export async function getProductReviews(productId: number): Promise<ProductReviews> {
  try {
    const raw = await wpFetchRaw(`/products/${productId}/reviews`);
    return raw ? normaliseReviews(raw) : EMPTY_REVIEWS;
  } catch (error) {
    console.error("[kandi-store] getProductReviews failed:", error);
    return EMPTY_REVIEWS;
  }
}

/** The public marketplace store directory. Empty when the plugin is older. */
export async function getStores(): Promise<Store[]> {
  try {
    const raw = await wpFetchRaw(`/stores`);
    const payload = (raw ?? {}) as { stores?: unknown };
    if (!Array.isArray(payload.stores)) return [];

    return payload.stores.map((entry) => {
      const store = (entry ?? {}) as Record<string, unknown>;
      return {
        id: Number(store.id ?? 0),
        store_name: String(store.store_name ?? ""),
        store_slug: String(store.store_slug ?? ""),
        logo: String(store.logo ?? ""),
        product_count: Number(store.product_count ?? 0) || 0,
        since: String(store.since ?? ""),
      };
    });
  } catch (error) {
    console.error("[kandi-store] getStores failed:", error);
    return [];
  }
}

/**
 * Collapses categories that share a name.
 *
 * WooCommerce happily holds several terms with the same label — "Hoodies",
 * "Hoodies-2", "Hoodies-3" — and this shop has a lot of them, mostly created by
 * imports and by the seller form that used to invent a term whenever a seller
 * typed a name that did not match. The shopper should never see the same
 * department three times, and a seller should never have to guess which of the
 * three is the real one.
 *
 * The survivor is the term holding the most products; ties go to the shortest
 * slug, which is the original rather than the `-2` WordPress appends to a
 * duplicate. Nothing is deleted in WordPress — this only decides what the
 * storefront shows.
 */
function dedupeByName(categories: ProductCategory[]): ProductCategory[] {
  const best = new Map<string, ProductCategory>();

  for (const category of categories) {
    const key = category.name.trim().toLowerCase();
    const held = best.get(key);

    if (
      !held ||
      (category.count ?? 0) > (held.count ?? 0) ||
      ((category.count ?? 0) === (held.count ?? 0) && category.slug.length < held.slug.length)
    ) {
      best.set(key, category);
    }
  }

  return [...best.values()];
}

export async function getCategories(): Promise<ProductCategory[]> {
  try {
    const raw = await wpFetchRaw(`/categories`, `/products/categories`);
    if (!raw) {
      return [];
    }

    const payload = raw as { categories?: unknown; products?: unknown };
    const items = Array.isArray(raw)
      ? raw
      : Array.isArray(payload.categories)
        ? payload.categories
        : Array.isArray(payload.products)
          ? payload.products
          : [];

    return dedupeByName(items.map(toCategory));
  } catch (error) {
    console.error("[kandi-store] getCategories failed:", error);
    return [];
  }
}
