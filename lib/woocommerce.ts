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
/**
 * A category and everything filed under it, to any depth.
 *
 * `children` is `CategoryNode[]` rather than `ProductCategory[]`, which is a
 * widening rather than a breaking change — a node still *is* a
 * `ProductCategory`, so every existing reader of `child.name` or `child.slug`
 * keeps working, and the ones that want to go deeper now can.
 */
export type CategoryNode = ProductCategory & { children: CategoryNode[] };

/**
 * Groups the flat category list from WordPress into departments and their
 * children. Categories whose parent is missing from the list are promoted to
 * top level so nothing silently disappears from the nav.
 */
export function buildCategoryTree(categories: ProductCategory[]): CategoryNode[] {
  /**
   * Every category becomes a node, at whatever depth it sits.
   *
   * The previous version created nodes only for top-level categories and then
   * pushed everything else into its parent's `children` as a flat
   * `ProductCategory`. That is a two-level tree by construction, and it threw
   * the third level away: this shop files Men → Shoes → Boots / Flats / Heels /
   * School Shoes, and every one of those grandchildren was dropped on the floor
   * because their parent — Shoes — was a child rather than a node, so there was
   * nothing to attach them to.
   *
   * Losing them mattered twice over. They are most of the catalogue's structure,
   * and they are exactly what a mega menu is for: a dropdown listing "Shoes" and
   * stopping is a dropdown that tells a shopper nothing they did not already
   * know from the word they hovered.
   */
  const nodes = new Map<number, CategoryNode>(
    categories.map((category) => [category.id, { ...category, children: [] }])
  );

  const roots: CategoryNode[] = [];

  for (const category of categories) {
    const node = nodes.get(category.id)!;
    const parentId = category.parent ?? 0;
    const parent = parentId === 0 ? undefined : nodes.get(parentId);

    // `parentId !== category.id` guards the one malformed row that would
    // otherwise make a node its own parent and hang anything that walks the
    // tree. Categories whose parent is missing from the list are promoted to
    // top level so nothing silently disappears from the nav.
    if (parent && parentId !== category.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  /** Busiest first, at every level rather than only the top one. */
  const sortByCount = (list: CategoryNode[]) => {
    list.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    for (const node of list) sortByCount(node.children);
  };
  sortByCount(roots);

  return roots;
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
  /**
   * The variation's own WooCommerce id.
   *
   * This is what an order line must carry to be an order for a particular size
   * rather than for the parent product with a note attached — see the
   * `variation_id` handling in `app/api/checkout/route.ts` and the check that
   * backs it in `kandi-store-api.php`.
   *
   * Optional in the type because a WordPress install running an older copy of
   * the plugin does not send it. Code that needs it must treat 0 or undefined
   * as "this deployment cannot identify variations" rather than assuming it is
   * there.
   */
  id?: number;
  /** This variation's own price, when the backend sends it. */
  price?: number;
  attributes: Record<string, string>;
  is_in_stock: boolean;
};

/** The marketplace store that owns a listing, when the Seller Centre plugin is active. */
export type ProductSeller = {
  id: number;
  store_name: string;
  store_slug: string;
  logo?: string;
  /**
   * The store's own colour, so "Sold by" can look like the store it leads to.
   * Optional because a product cached before the plugin started sending it will
   * not have one; callers fall back to the shop default.
   */
  store_color?: string;
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
  /**
   * Sort key, applied by WordPress across the whole result set.
   *
   * The listing pages used to sort the page they had already been given, which
   * is only correct while the results fit on one page. Sorting has to happen
   * where the pagination happens or the two disagree.
   *
   * `discount` is absent on purpose: it is a computed comparison between two
   * meta values and WooCommerce cannot order by it, so that one stays a
   * page-local refinement. See `sortProducts`.
   */
  sort?: "price_asc" | "price_desc" | "newest" | "popular" | "rating";
  /** Restrict to products currently in stock. */
  in_stock?: boolean;
  min_price?: number;
  max_price?: number;
};

/** A marketplace store, as shown in the public directory. */
export type Store = {
  id: number;
  store_name: string;
  store_slug: string;
  logo: string;
  product_count: number;
  since: string;
  /**
   * The colour behind this store's name on its own page, chosen by the seller.
   *
   * Always a six-digit hex — WordPress refuses anything else and falls back to
   * the shop default — so a caller can pass it straight to CSS and to a
   * luminance calculation without re-validating it.
   */
  store_color: string;
};

/**
 * How long a product read is reused before the shop asks WordPress again.
 *
 * ---- Why this was 15 seconds, and why that was costing real time ----
 *
 * The window was cut to 15s because a product deleted in wp-admin kept
 * appearing on the shop, and being a few hundred milliseconds slower looked
 * like the cheaper problem. It was not, for a reason that is invisible until
 * you look at which pages are rendered when:
 *
 *   • On a PRERENDERED page an expired window costs the shopper nothing — Next
 *     serves the stale HTML instantly and refreshes it in the background. That
 *     is the case the 15s was reasoned about.
 *   • On a page rendered PER REQUEST — which /products/[id] was until the
 *     `generateStaticParams` added alongside this change, and which /search,
 *     /sale and /category still are — an expired entry is re-fetched INLINE.
 *     The shopper waits for WordPress. Four reads on a product page against a
 *     shared WordPress host is most of a second, and at a 15-second window
 *     nearly every visit paid it: a shop with a visitor a minute missed the
 *     cache on all four reads, every time.
 *
 * So the window was not buying freshness that anyone asked for; it was making
 * the cache miss on almost every request that mattered.
 *
 * ---- Why 5 minutes is safe ----
 *
 * The window is not how the shop stays correct, and it has not been for a
 * while. WordPress PUSHES a purge the moment anything about a product changes
 * — save, trash, delete, and the WooCommerce CRUD hooks that a stock change
 * fires — which lands on /api/revalidate and drops the tag below outright (see
 * kandi-storefront-settings.php). A deleted product is gone from the shop on
 * the next page load, not in five minutes.
 *
 * This number is only the fallback for when that push cannot get through: the
 * plugin is not installed, the storefront URL was never registered, or the
 * request was dropped. Five minutes is a reasonable ceiling for a shop running
 * without its own purge webhook, and it is 20× fewer WordPress round trips on
 * the request path than 15 seconds was.
 */
const REVALIDATE_SECONDS = 300;

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
 * The window above is what makes the shop fast, and this tag is what makes the
 * window affordable: a product added or deleted in the admin would otherwise
 * keep showing its old self until the window lapsed. Tagging the reads lets a
 * write clear them the moment it happens (see app/api/owner/[...path]/route.ts
 * and the purge the WordPress plugin pushes) instead of waiting it out — which
 * is exactly why the window could go from 15 seconds to 5 minutes without the
 * shop getting any staler in practice. Kept in step with PRODUCTS_TAG in
 * lib/owner-server.ts.
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

/**
 * The origin serving the WordPress media library — `https://shop.example.com`.
 *
 * Used by the layout to open a connection to it before the first product photo
 * asks for one. Derived from `WP_API_URL` rather than configured separately,
 * because a preconnect to a host the images do not come from is a wasted
 * connection and a second setting nobody would remember to change.
 *
 * Returns null rather than throwing when the variable is missing: a preconnect
 * is an optimisation, and it must never be the reason a page fails to render.
 */
export function wordpressOrigin(): string | null {
  const url = process.env.WP_API_URL;
  if (!url) return null;

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
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
      name: decodeEntities(str(category.name)),
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

  const attributes: ProductAttribute[] = arr(product.attributes).map((entry) => {
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
  });

  /**
   * The value a variation names, said the way the option list says it.
   *
   * ---- The mismatch this exists to absorb ----
   *
   * WooCommerce stores a variation's choice for a TAXONOMY attribute as the
   * term's slug — `dark-brown` — while the option list beside it carries the
   * term's name, `Dark Brown`. Everything downstream compares the two with
   * `===`: the website's `isOptionAvailable` asks whether any variation has
   * `attributes[attrName] === optionName`, and the app now asks the same
   * question of the same table.
   *
   * With slugs on one side and names on the other that comparison never
   * matches, and the failure is silent and total in the worst direction — no
   * variation matches ANY option, so every size and colour on a variable
   * product renders crossed out and unbuyable. Custom (non-taxonomy)
   * attributes store the name and were fine, which is why this only shows up
   * on shops whose sizes and colours are real attribute terms.
   *
   * Matching by slug both ways rather than un-slugging: names are not
   * recoverable from slugs (`dark-brown` could be "Dark Brown" or "dark
   * brown"), but a name always slugifies to the slug WooCommerce made from it.
   * A value with no match — an attribute the seller has since deleted — is
   * passed through untouched, so it simply matches nothing rather than
   * becoming something else.
   */
  const slugify = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "-");

  const canonicalOption = (attributeName: string, rawValue: string): string => {
    const attribute = attributes.find((item) => item.name === attributeName);
    if (!attribute) return rawValue;
    const match = attribute.options.find(
      (option) =>
        option.name === rawValue || slugify(option.name) === slugify(rawValue)
    );
    return match ? match.name : rawValue;
  };

  return {
    id: num(product.id),
    /* ---- Decoded, for the same reason category names are ----
     *
     * WordPress stores post titles HTML-encoded, so "David Ultimate Protection
     * & Cozy Mosquito Net" arrives as "…Protection &amp; Cozy…". React then
     * renders that entity as literal text — correctly, because a product name
     * is text and not markup — and the shopper reads "&amp;" in the middle of
     * the name, on the tile, in the cart, in the order confirmation and in the
     * email.
     *
     * `decodeEntities` was written for exactly this and was only ever wired to
     * category names, which is why the menu was clean and every product tile
     * was not. */
    name: decodeEntities(str(product.name)),
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
    // Same treatment: this is printed as text under the price on the product
    // page and in the seller's order emails.
    short_description: decodeEntities(
      str(product.short_description ?? product.shortDescription)
    ),
    categories,
    attributes,
    variations: Array.isArray(product.variations)
      ? product.variations.map((entry) => {
          const variation = obj(entry);
          const chosen = obj(variation.attributes);
          return {
            id: num(variation.id) || undefined,
            price: variation.price == null ? undefined : num(variation.price),
            attributes: Object.fromEntries(
              Object.entries(chosen).map(([name, value]) => [
                name,
                canonicalOption(name, str(value)),
              ])
            ) as Record<string, string>,
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
          store_color: str(seller.store_color) || undefined,
        }
      : undefined,
  };
}

/**
 * WordPress stores term names HTML-encoded, so "Candles & Scents" arrives as
 * "Candles &amp; Scents" and React — correctly — renders the entity as
 * literal text, because a category name is text and not markup. Decoding here
 * rather than at each call site means the menu, the category page and the
 * breadcrumbs all get it, and none of them has to remember to.
 *
 * Only the five XML entities plus the numeric forms: a term name is a short
 * label, and anything beyond this would be a licence to feed markup through.
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Last, so "&amp;lt;" decodes to the text "&lt;" rather than to "<".
    .replace(/&amp;/g, "&");
}

function toCategory(raw: unknown): ProductCategory {
  const category = obj(raw);
  return {
    id: num(category.id),
    name: decodeEntities(str(category.name)),
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
    if (query.sort) params.set("sort", query.sort);
    if (query.in_stock) params.set("in_stock", "1");
    if (query.min_price) params.set("min_price", String(query.min_price));
    if (query.max_price) params.set("max_price", String(query.max_price));

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

/**
 * Same as `getProducts`, but an unreachable WordPress becomes an empty list
 * rather than an exception — so a page still renders while the backend is down
 * or not yet configured.
 *
 * ---- Why this now retries, and why that is not belt-and-braces ----
 *
 * "Renders" was doing a lot of work in that sentence. The homepage builds nine
 * shelves out of ONE call to this function (`per_page: 48`), so a single failed
 * request does not degrade the page — it empties it: no For-you grid, no Best
 * sellers, no New in, no Just landed, and a `trending` pool that falls back to
 * the same empty array. The shop renders a working masthead over a page with
 * nothing to buy on it.
 *
 * Then Next caches that. The page is ISR with a revalidate window, so one
 * timeout during one regeneration is served to every visitor until the window
 * expires. That is the failure this shop actually had, and from the outside it
 * looks exactly like the catalogue having been deleted.
 *
 * The plugin's own notes say `/products?per_page=24` has taken between 47 and
 * 117 seconds on this host. A request that slow fails often, and the biggest
 * request on the page is the one most likely to be the one that fails.
 *
 * So: one retry, after a short pause. It costs nothing on the happy path — the
 * overwhelming majority of calls succeed first time — and it turns the common
 * failure (one slow request in a burst of six) back into a working page.
 *
 * It is deliberately ONE retry rather than a loop with backoff. If WordPress is
 * genuinely down, hammering it while it is trying to recover is the wrong
 * thing, and the caller already has an empty-list contract to honour.
 */
export async function getProductsSafe(
  query: ProductQuery = {}
): Promise<ProductListResponse> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await getProducts(query);

      /* An empty list is not automatically a failure — `on_sale` legitimately
         returns nothing on a shop with no sale running — so the retry is on the
         first attempt only, and a second empty answer is taken as the truth. */
      if (result.products.length > 0 || attempt > 0) return result;
    } catch (error) {
      console.error(`[kandi-store] getProducts failed (attempt ${attempt + 1}):`, error);
      if (attempt > 0) return { products: [], total: 0, total_pages: 0 };
    }

    // Long enough for a transient blip to clear, short enough that a shopper
    // waiting on a cold render does not notice it.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return { products: [], total: 0, total_pages: 0 };
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
        // Defaulted here as well as in WordPress: a store read from an install
        // running the previous plugin has no colour at all, and an empty string
        // reaching a background declaration is a transparent header.
        store_color: String(store.store_color ?? "") || "#1c1a18",
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
    /**
     * Keyed on the parent as well as the name — and that is the whole fix.
     *
     * This used to key on the name alone, which is correct for the duplicate it
     * was written for (two unrelated top-level categories both called "Shoes")
     * and catastrophic for a properly built catalogue. This shop files Hoodies,
     * Jewelry and Shoes under *each* of Men, Women and Kids: nine real
     * categories, three distinct names. Deduping globally kept three of the nine
     * and silently deleted the rest, so Women and Kids came back with no
     * children at all and their mega menus had nothing to show.
     *
     * Two categories with the same name under different parents are different
     * categories — "Men → Shoes" and "Women → Shoes" hold different products and
     * have different slugs. Only a repeat *within the same parent* is a genuine
     * duplicate, and that is what this now collapses.
     */
    const key = `${category.parent ?? 0}::${category.name.trim().toLowerCase()}`;
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
