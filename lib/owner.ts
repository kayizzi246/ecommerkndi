/**
 * Types and browser-side client for the owner's product manager.
 *
 * Every call goes to /api/owner/*, where a route handler attaches the shared
 * API secret and the owner passcode before proxying to `kandi/v1/owner/*`.
 * Unlike the Seller Centre client in lib/seller.ts, these endpoints see every
 * product in the shop — including the ones added straight in wp-admin, which
 * carry no seller and are therefore invisible to the seller API.
 */

export type OwnerProductStatus = "publish" | "pending" | "draft" | "private";

export type OwnerProduct = {
  id: number;
  name: string;
  sku: string;
  status: OwnerProductStatus;
  price: number;
  regular_price: number;
  sale_price: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  image: string;
  gallery: string[];
  categories: string[];
  description: string;
  short_description: string;
  units_sold: number;
  permalink: string;
  created_at: string | null;
  /** 0 when the shop itself owns the listing rather than a marketplace seller. */
  seller_id: number;
  seller_name: string;
};

export type OwnerCategory = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

export type OwnerProductInput = {
  name: string;
  description?: string;
  short_description?: string;
  regular_price: number;
  sale_price?: number | null;
  sku?: string;
  stock_quantity?: number;
  category?: string;
  status?: OwnerProductStatus;
  sizes?: string[];
  colors?: string[];
  image_urls?: string[];
};

/** One order as the admin's action lists show it. */
export type OwnerOrderRow = {
  id: number;
  number: string;
  status: string;
  total: number;
  customer: string;
  phone: string;
  city: string;
  items: string[];
  units: number;
  created_at: string | null;
  /** The order's wp-admin edit screen. */
  edit_url: string;
};

/** GET /owner/stats — the sales-first admin overview. */
export type OwnerStats = {
  currency: string;
  revenue: number;
  revenue_change: number;
  orders: number;
  orders_change: number;
  average_order: number;
  units_sold: number;
  revenue_series: { date: string; revenue: number; orders: number }[];
  top_products: { id: number; name: string; units: number; revenue: number }[];
  /** Shoppers who reached payment in the last 7 days and did not finish, one per phone. */
  recover: OwnerOrderRow[];
  recover_total: number;
  /** Paid orders still waiting to be sent, oldest first. */
  to_ship: OwnerOrderRow[];
  /** Products that have sold before and are now out of stock, best sellers first. */
  sold_out_best: { id: number; name: string; units_sold: number; price: number; image: string }[];
  products_live: number;
  products_sold_out: number;
};

export class OwnerApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OwnerApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/owner${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (payload as { message?: string; error?: string }).message ??
      (payload as { error?: string }).error ??
      `Request failed (${response.status})`;
    throw new OwnerApiError(message, response.status);
  }

  return payload as T;
}

export const ownerApi = {
  login: (passcode: string) =>
    request<{ ok: true; site_name: string; products: number }>("/login", {
      method: "POST",
      body: JSON.stringify({ passcode }),
    }),

  logout: () => request<{ ok: true }>("/logout", { method: "POST" }),

  me: () => request<{ ok: true; site_name: string; products: number }>("/me"),

  categories: () => request<{ categories: OwnerCategory[] }>("/categories"),

  stats: (range: string) => request<OwnerStats>(`/stats?range=${encodeURIComponent(range)}`),

  products: (search = "") =>
    request<{ products: OwnerProduct[] }>(
      `/products${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),

  createProduct: (input: OwnerProductInput) =>
    request<{ product: OwnerProduct }>("/products", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateProduct: (id: number, input: Partial<OwnerProductInput>) =>
    request<{ product: OwnerProduct }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  /** Trashes the listing; `force` deletes it permanently. */
  deleteProduct: (id: number, force = false) =>
    request<{ ok: true }>(`/products/${id}${force ? "?force=1" : ""}`, {
      method: "DELETE",
    }),
};
