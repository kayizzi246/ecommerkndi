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
  /** False until the six-digit code emailed at sign-up has been entered. */
  email_verified: boolean;
  /**
   * Business verification. "missing" until the seller sends their national ID
   * and answers the registration question; "submitted" while the marketplace
   * team looks at it; "approved" once the store is approved.
   */
  kyc_status: "missing" | "submitted" | "approved" | "rejected";
  business_registered: "" | "yes" | "no";
  business_name: string;
  business_number: string;
};

/** What the setup gate still needs from a seller before the dashboard opens. */
export type KycInput = {
  business_registered: "yes" | "no";
  business_name?: string;
  business_number?: string;
  id_document?: File | null;
  business_document?: File | null;
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
  /** Main photo, thumbnail size — what the product list renders. */
  image: string;
  /** Every photo at full size, main first. What the editor loads and sends back. */
  images: string[];
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
  /** Whether this seller has confirmed they are packing their part. */
  accepted: boolean;
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
  /**
   * WordPress's own error slug — `kandi_unverified`, `kandi_rate_limited` and
   * so on. The UI branches on this rather than on the wording, so rephrasing a
   * message in the plugin cannot quietly break a screen over here.
   */
  code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.name = "SellerApiError";
    this.status = status;
    this.code = code;
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
    throw new SellerApiError(
      message,
      response.status,
      (payload as { code?: string }).code ?? ""
    );
  }

  return payload as T;
}

/**
 * Uploads one product photo and returns its media-library URL, which is then
 * passed to createProduct/updateProduct as an entry in `image_urls`.
 *
 * Deliberately outside `request`: that helper forces a JSON content type, and
 * a multipart body must carry the boundary fetch generates for it.
 */
async function uploadImage(file: File): Promise<{ id: number; url: string }> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/seller/media", { method: "POST", body });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (payload as { message?: string }).message ?? `Upload failed (${response.status})`;
    throw new SellerApiError(message, response.status, (payload as { code?: string }).code ?? "");
  }

  return payload as { id: number; url: string };
}

/**
 * Sends the verification documents. Multipart, so it bypasses `request`.
 */
async function submitKyc(input: KycInput): Promise<{ seller: Seller }> {
  const body = new FormData();
  body.append("business_registered", input.business_registered);
  if (input.business_name) body.append("business_name", input.business_name);
  if (input.business_number) body.append("business_number", input.business_number);
  if (input.id_document) body.append("id_document", input.id_document);
  if (input.business_document) body.append("business_document", input.business_document);

  const response = await fetch("/api/seller/kyc", { method: "POST", body });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SellerApiError(
      (payload as { message?: string }).message ?? `Upload failed (${response.status})`,
      response.status,
      (payload as { code?: string }).code ?? ""
    );
  }

  return payload as { seller: Seller };
}

export const sellerApi = {
  uploadImage,
  submitKyc,

  login: (email: string, password: string) =>
    request<{ seller: Seller }>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ ok: true }>("/logout", { method: "POST" }),

  /**
   * Opens a seller account.
   *
   * `password` and `google_credential` are the two ways in and exactly one is
   * required: a password account has to prove its email address with a code,
   * a Google account arrives already proven and is signed in by the response.
   */
  register: (input: {
    store_name: string;
    owner_name: string;
    phone: string;
    city: string;
    category: string;
    email?: string;
    password?: string;
    /** The raw Google ID token, re-verified server-side before anything is created. */
    google_credential?: string;
  }) =>
    request<{ seller: Seller; message: string }>("/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** Exchanges the emailed code for a session — this signs the seller in. */
  verify: (email: string, code: string) =>
    request<{ seller: Seller }>("/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  resendCode: (email: string) =>
    request<{ ok: true; message: string }>("/verify/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
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

  /** Confirms the seller has the stock and is packing their part of an order. */
  acceptOrder: (id: number) =>
    request<{ ok: true; accepted: boolean; status: string }>(`/orders/${id}/accept`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  commissions: (range: string) =>
    request<CommissionSummary>(`/commissions?range=${encodeURIComponent(range)}`),

  requestPayout: () => request<{ ok: true; message: string }>("/payouts", { method: "POST" }),

  updateSettings: (input: Partial<Seller>) =>
    request<{ seller: Seller }>("/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};
