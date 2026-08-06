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
};

const REVALIDATE_SECONDS = 60;

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
  const customUrl = `${baseUrl()}${path}`;
  if (!fallbackPath) {
    return [customUrl];
  }

  return [customUrl, `${storeApiBaseUrl()}${fallbackPath}`];
}

async function wpFetchRaw(path: string, fallbackPath?: string): Promise<unknown | null> {
  const urls = getCandidateUrls(path, fallbackPath);
  let lastStatus = 0;

  for (const url of urls) {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
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

function toProduct(raw: any): Product {
  const product = raw ?? {};
  const prices = product.prices ?? {};
  const price = Number(prices.price ?? product.price ?? 0);
  const regularPrice = Number(prices.regular_price ?? prices.price ?? product.regular_price ?? price);
  const salePrice = prices.sale_price != null ? Number(prices.sale_price) : product.sale_price != null ? Number(product.sale_price) : null;
  const onSale = salePrice != null && regularPrice > 0 && salePrice < regularPrice;

  const categories = Array.isArray(product.categories)
    ? product.categories.map((category: any) => ({
        id: Number(category.id ?? 0),
        name: category.name ?? "",
        slug: category.slug ?? "",
        count: category.count ?? undefined,
      }))
    : Array.isArray(product.categories)
      ? []
      : [];

  const images = Array.isArray(product.images) ? product.images : [];
  const gallery = images.map((image: any) => image?.src ?? "").filter(Boolean);

  return {
    id: Number(product.id ?? 0),
    name: product.name ?? "",
    slug: product.slug ?? "",
    price,
    regular_price: regularPrice,
    sale_price: salePrice,
    on_sale: Boolean(product.on_sale ?? onSale),
    featured: Boolean(product.featured),
    stock_status: (product.stock_status as Product["stock_status"]) ?? "outofstock",
    stock_quantity: product.stock_quantity ?? null,
    image: gallery[0] ?? product.image ?? "",
    gallery,
    date_created: product.date_created ?? null,
    short_description: product.short_description ?? product.shortDescription ?? "",
    categories,
    attributes: Array.isArray(product.attributes)
      ? product.attributes.map((attribute: any) => ({
          name: String(attribute?.name ?? ""),
          options: Array.isArray(attribute?.options)
            ? attribute.options.map((option: any) =>
                typeof option === "string"
                  ? { name: option }
                  : {
                      name: String(option?.name ?? option?.label ?? ""),
                      value: option?.value ?? undefined,
                      image: option?.image ?? option?.image_url ?? undefined,
                    }
              )
            : [],
        }))
      : [],
    variations: Array.isArray(product.variations)
      ? product.variations.map((variation: any) => ({
          attributes: variation?.attributes ?? {},
          is_in_stock: Boolean(variation?.is_in_stock ?? variation?.in_stock),
        }))
      : undefined,
    description: product.description ?? undefined,
    seller: product.seller
      ? {
          id: Number(product.seller.id ?? 0),
          store_name: String(product.seller.store_name ?? ""),
          store_slug: String(product.seller.store_slug ?? ""),
          logo: product.seller.logo || undefined,
        }
      : undefined,
  };
}

function toCategory(raw: any): ProductCategory {
  return {
    id: Number(raw?.id ?? 0),
    name: raw?.name ?? "",
    slug: raw?.slug ?? "",
    count: raw?.count != null ? Number(raw.count) : undefined,
    parent: raw?.parent != null ? Number(raw.parent) : 0,
    image: raw?.image ?? raw?.image?.src ?? null,
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

export async function getProduct(id: number): Promise<Product | null> {
  try {
    const raw = await wpFetchRaw(`/products/${id}`, `/products/${id}`);
    if (!raw) {
      return null;
    }
    return toProduct(raw);
  } catch {
    return null;
  }
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

    return items.map(toCategory);
  } catch (error) {
    console.error("[kandi-store] getCategories failed:", error);
    return [];
  }
}
