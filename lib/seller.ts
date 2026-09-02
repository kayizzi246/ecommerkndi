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
  /** The colour behind the store name on its public page. Six-digit hex. */
  store_color: string;
  email: string;
  phone: string;
  owner_name: string;
  status: SellerStatus;
  commission_rate: number;
  payout_method: string;
  payout_account: string;
  registered_at: string;
  logo: string;
  /**
   * The monthly seller fee.
   *
   * "paid" means paid up *today*, not "has ever paid" — WordPress derives this
   * from `fee_paid_until` against the clock rather than storing a flag, so it
   * cannot go stale. "waived" when the shop charges nothing.
   *
   * A seller who lapses to "unpaid" has their products hidden from the shop.
   * Nothing is deleted: the account, the listings and the order history all
   * survive, and paying puts them straight back.
   */
  fee_status: "unpaid" | "paid" | "waived";
  /** What one month costs, fixed at the amount in force when they joined. */
  fee_amount: number;
  /**
   * ISO-8601 date the current month of cover runs out, or null if never paid.
   *
   * Worth showing rather than just the status: "your cover runs out on 14
   * September" is something a seller can act on, where "unpaid" is only a
   * demand delivered after the shopfront has already gone.
   */
  fee_paid_until: string | null;
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
  /**
   * Product page views in the selected range, and the change on the previous
   * one.
   *
   * Optional, and that is load-bearing rather than laziness: these arrive from
   * a WordPress endpoint that older installs of the plugin do not have, and a
   * dashboard that renders "0 views" against a plugin which simply is not
   * counting yet tells a seller their listings are dead when they are not.
   * `undefined` means "not measured"; `0` means "measured, and nobody looked".
   * The dashboard draws the tile only for the first of those.
   */
  views?: number;
  views_change?: number;
  /** Daily revenue series for the selected range. */
  revenue_series: { date: string; revenue: number; orders: number }[];
  /**
   * Best performing products in the selected range.
   *
   * `views` is optional here for the same reason, and it is the field that
   * makes this table worth reading: units alone cannot distinguish a listing
   * nobody found from a listing everybody found and nobody bought, and those
   * two need opposite fixes.
   */
  top_products: {
    id: number;
    name: string;
    units: number;
    revenue: number;
    views?: number;
  }[];
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
  /**
   * Where the parcel goes and who to ring about it.
   *
   * Optional across the board, and that is about deployment rather than about
   * privacy: these fields are served by a version of the seller plugin that an
   * install may not have yet, and a Seller Centre that renders "undefined" as
   * an address is worse than one that renders nothing. Every consumer checks.
   *
   * Nothing here belongs to another store. The line items on this order are
   * already filtered to this seller, so a shared basket never shows a
   * competitor's sale — only the delivery it also has to reach.
   */
  phone?: string;
  email?: string;
  address_1?: string;
  address_2?: string;
  /** The pin the shopper dropped at checkout, as a Maps link. */
  map_url?: string;
  /** Whatever the shopper typed in "anything the rider should know". */
  note?: string;
  payment?: string;
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

/** One request for money to leave the marketplace. */
export type PayoutRequest = {
  id: number;
  amount: number;
  method: string;
  account: string;
  /**
   * "requested" is the state the seller sees as *Processing* — finance has it
   * and has not sent it yet. "paid" and "cancelled" are both terminal.
   */
  status: "requested" | "paid" | "cancelled";
  note: string;
  requested_at: string | null;
  paid_at: string | null;
};

/** What the payout dialog opens with. */
export type PayoutOverview = {
  currency: string;
  /** Cleared and withdrawable right now — the ceiling on a request. */
  payable: number;
  /** Earned but not yet cleared. Shown so the ceiling makes sense. */
  pending: number;
  /** The floor, already capped at `payable` by the server. */
  minimum: number;
  /** The account on file, which the dialog prefills. */
  method: string;
  account: string;
  /** The methods this marketplace can actually send money through. */
  methods: string[];
  /** True while a request is with finance. Only one may be open at a time. */
  open: boolean;
  payouts: PayoutRequest[];
};

export type NewProductInput = {
  name: string;
  description: string;
  short_description: string;
  regular_price: number;
  sale_price?: number | null;
  sku: string;
  stock_quantity: number;
  /**
   * The category SLUG, not its name.
   *
   * WordPress resolves this with `term_exists`, which matches a slug or a name
   * — and a name is ambiguous here. This shop has 17 category names living in
   * more than one branch: "Shoes" exists under Men, Women AND Kids, and
   * `term_exists('Shoes')` returns whichever of the three the database hands
   * back first. Sending `shoes-women` files a women's sandal under Women every
   * time; sending "Shoes" was a one-in-three guess.
   */
  category: string;
  sizes: string[];
  colors: string[];
  /**
   * A photograph of the product in each colour, keyed by the colour name.
   *
   * Keyed by name rather than by index because `colors` is a set the plugin
   * re-derives on every save — an index would silently re-point every picture
   * the moment a seller removed a colour from the middle of the list.
   *
   * Sparse on purpose: a seller with eight colours and photographs of three
   * sends three entries, and the storefront falls back to a plain colour dot
   * for the rest. See `components/seller/ColorOptions`.
   */
  color_images?: Record<string, string>;
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
    /**
     * Never from a cache, at any layer.
     *
     * Every seller asks the same URL — `/api/seller/me` — so a cached copy is
     * not a stale copy of *their* dashboard, it is somebody else's. A seller
     * here signed in with their own address and was shown a different store,
     * and suspending that store changed nothing, because the reply was being
     * answered before it ever reached the server.
     *
     * The server sends `private, no-store` as well. Both ends, because this is
     * the one thing in the app where a cache hit is a breach.
     */
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
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
   * Forgets whatever session this browser is carrying, without destroying the
   * token on WordPress.
   *
   * Called by the sign-in and sign-up screens as they open. Both are, by
   * definition, screens for somebody who is not yet signed in — so arriving at
   * either means the cookie already in the browser belongs to a *previous*
   * occupant, and acting on it is how a new seller ends up looking at an old
   * seller's dashboard.
   *
   * See /api/seller/session/end for why this is not `logout`.
   */
  endSession: () => request<{ ok: true }>("/session/end", { method: "POST" }),

  /**
   * Opens a seller account, and signs it in.
   *
   * `password` and `google_credential` are the two ways in and exactly one is
   * required. Either way the response carries a session cookie, so the new
   * seller lands in their own dashboard rather than behind a code screen: a
   * password account is additionally emailed a code, which confirms the address
   * afterwards and gates payouts until it is entered.
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
    request<{ seller: Seller }>("/register", {
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

  /**
   * Who this browser is signed in as. The only source of seller identity.
   *
   * Calls `/session`, not `/me`. On a live install `/seller/me` was registered
   * a second time by a snippet outside the plugin, with no authentication and
   * one seller's id baked in — WordPress merges duplicate route registrations
   * and dispatches the first match, so that copy answered every request. Every
   * seller who signed in was correctly issued their own token and then shown
   * the same stranger's store, because this call was the one being lied to.
   *
   * `checked: true` is set only by the authenticated handler. A 200 without it
   * is an impostor answering on that path, and is rejected here rather than
   * rendered as somebody's dashboard — if the shape is wrong we have no idea
   * whose account we are looking at, and showing it is the actual harm.
   */
  me: async (): Promise<{ seller: Seller }> => {
    const payload = await request<{ seller: Seller; checked?: boolean }>("/session");

    if (!payload?.checked || !payload.seller) {
      throw new SellerApiError(
        "The seller backend answered the identity check without authenticating it. " +
          "Another plugin or snippet on WordPress is registering kandi/v1/seller/* — " +
          "remove it, then sign in again.",
        502,
        "kandi_identity_untrusted"
      );
    }

    return { seller: payload.seller };
  },

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

  /** The balance, the account on file, and every request already made. */
  payouts: () => request<PayoutOverview>("/payouts"),

  /**
   * Asks for money.
   *
   * `amount` is optional and omitting it means "everything cleared", which is
   * what the button did before there was a dialog. It is a request rather than
   * an instruction: the server re-reads the balance, refuses anything above it,
   * and fills the request from whole cleared orders — so the amount that comes
   * back in `payout.amount` is the one that will actually be sent, and can be
   * a little under what was asked for. The dialog shows what came back rather
   * than what it sent.
   */
  requestPayout: (input?: { amount?: number; method?: string; account?: string }) =>
    request<{
      ok: true;
      message: string;
      payout: PayoutRequest;
      requested_amount: number;
      payable_left: number;
    }>("/payouts", {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    }),

  updateSettings: (input: Partial<Seller>) =>
    request<{ seller: Seller }>("/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};
