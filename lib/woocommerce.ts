export type ProductCategory = {
  id: number;
  name: string;
  slug: string;
  count?: number;
};

export type ProductAttribute = {
  name: string;
  options: string[];
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
  description?: string;
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

async function wpFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    throw new Error(`WordPress request failed (${res.status}): ${path}`);
  }

  return res.json();
}

export async function getProducts(
  query: ProductQuery = {}
): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.per_page) params.set("per_page", String(query.per_page));
  if (query.category) params.set("category", query.category);
  if (query.search) params.set("search", query.search);
  if (query.on_sale) params.set("on_sale", "1");
  if (query.featured) params.set("featured", "1");

  const qs = params.toString();
  return wpFetch<ProductListResponse>(`/products${qs ? `?${qs}` : ""}`);
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
    return await wpFetch<Product>(`/products/${id}`);
  } catch {
    return null;
  }
}

export async function getCategories(): Promise<ProductCategory[]> {
  try {
    return await wpFetch<ProductCategory[]>(`/categories`);
  } catch (error) {
    console.error("[kandi-store] getCategories failed:", error);
    return [];
  }
}
