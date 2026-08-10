/**
 * Types and browser-side client for the Kandi Seller Centre.
 *
 * The browser never talks to WordPress directly: every call goes to
 * /api/seller/*, where a Next.js route handler attaches the seller's session
 * token (httpOnly cookie) and the shared API secret before proxying to the
 * `kandi/v1/seller/*` endpoints exposed by the kandi-seller-api plugin.
 */

export type SellerStatus = "pending" | "approved" | "suspended" | "rejected";

export type Seller = {
  id: number;
  store_name: string;
  store_slug: string;
  email: string;
  phone: string;
  owner_name: string;
  status: SellerStatus;
  commission_rate: number;
  payout_method: string;
  payout_account: string;
  registered_at: string;
  logo: string;
  /** One-off registration fee. "waived" when the shop charges nothing. */
  fee_status: "unpaid" | "paid" | "waived";
  fee_amount: number;
  /** The reference the seller quotes when paying. */
  fee_reference: string;
};

export type SellerStats = {
  currency: string;
  revenue: number;
  revenue_change: number;
  orders: number;
  orders_change: number;
  units_sold: number;
  commission_owed: number;
  commission_paid: number;
  payout_due: number;
  products_live: number;
  products_pending: number;
  products_out_of_stock: number;
  /** Daily revenue series for the selected range. */
  revenue_series: { date: string; revenue: number; orders: number }[];
  /** Best performing products in the selected range. */
  top_products: { id: number; name: string; units: number; revenue: number }[];
  /** Revenue split by product category. */
  category_split: { name: string; revenue: number }[];
};

export type SellerProduct = {
  id: number;
  name: string;
  sku: string;
  status: "publish" | "pending" | "draft";
  price: number;
  regular_price: number;
  sale_price: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  image: string;
  categories: string[];
  units_sold: number;
  created_at: string;
};

export type SellerOrderLine = {
  product_id: number;
  name: string;
  quantity: number;
  total: number;
  commission: number;
};

export type SellerOrder = {
  id: number;
  number: string;
  status: string;
  customer: string;
  city: string;
  date: string;
  seller_total: number;
  commission: number;
  net_payout: number;
  items: SellerOrderLine[];
};

export type CommissionEntry = {
  id: number;
  order_id: number;
  date: string;
  gross: number;
  rate: number;
  commission: number;
  net: number;
  status: "pending" | "payable" | "paid";
};

export type CommissionSummary = {
  currency: string;
  rate: number;
  gross: number;
  commission_total: number;
  net_total: number;
  paid: number;
  payable: number;
  pending: number;
  entries: CommissionEntry[];
};

export type NewProductInput = {
  name: string;
  description: string;
  short_description: string;
  regular_price: number;
  sale_price?: number | null;
  sku: string;
  stock_quantity: number;
  category: string;
  sizes: string[];
  colors: string[];
  image_urls: string[];
};

export class SellerApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SellerApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/seller${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (payload as { message?: string; error?: string }).message ??
      (payload as { error?: string }).error ??
      `Request failed (${response.status})`;
    throw new SellerApiError(message, response.status);
  }

  return payload as T;
}

export const sellerApi = {
  login: (email: string, password: string) =>
    request<{ seller: Seller }>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ ok: true }>("/logout", { method: "POST" }),

  register: (input: {
    store_name: string;
    owner_name: string;
    email: string;
    phone: string;
    password: string;
    city: string;
    category: string;
  }) =>
    request<{ seller: Seller; message: string }>("/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  me: () => request<{ seller: Seller }>("/me"),

  stats: (range: string) => request<SellerStats>(`/stats?range=${encodeURIComponent(range)}`),

  products: () => request<{ products: SellerProduct[] }>("/products"),

  createProduct: (input: NewProductInput) =>
    request<{ product: SellerProduct }>("/products", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateProduct: (id: number, input: Partial<NewProductInput> & { status?: string }) =>
    request<{ product: SellerProduct }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  deleteProduct: (id: number) =>
    request<{ ok: true }>(`/products/${id}`, { method: "DELETE" }),

  orders: (status = "any") =>
    request<{ orders: SellerOrder[] }>(`/orders?status=${encodeURIComponent(status)}`),

  commissions: (range: string) =>
    request<CommissionSummary>(`/commissions?range=${encodeURIComponent(range)}`),

  requestPayout: () => request<{ ok: true; message: string }>("/payouts", { method: "POST" }),

  updateSettings: (input: Partial<Seller>) =>
    request<{ seller: Seller }>("/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};
