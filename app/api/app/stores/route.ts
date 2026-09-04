import { getStores, getProductsSafe, type Product } from "@/lib/woocommerce";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { appImage, APP_CACHE_HEADERS } from "@/lib/app-api";
import { absolute } from "@/lib/seo";
import { storeHref } from "@/lib/store-routes";

/**
 * The store directory, for the app's "Shop by store" screen.
 *
 * Mirrors what the website's `/sellers` page renders, and for the same reason
 * that page was rebuilt: a list of store names is not a place to shop. Nobody
 * knows what "Sports Kicks" sells, and "14 products" does not tell them — so
 * each store carries a strip of its actual merchandise, which is the only thing
 * on the row that answers the question the row raises.
 *
 * ## The order is the website's order
 *
 * Stocked stores first, by how much they stock. Two of this shop's stores have
 * nothing listed yet; they stay in the payload rather than being filtered out —
 * they are real approved sellers with real pages — and the app says they are
 * setting up instead of drawing four grey boxes.
 *
 * ## Cost
 *
 * One catalogue read per stocked store, in parallel, skipped entirely for a
 * store that has already told us it has none. Cached at the edge like every
 * other app endpoint.
 */

export const revalidate = 300;

/** Four fills the preview strip on a phone without wrapping. */
const PREVIEW_COUNT = 4;

export async function GET(request: Request) {
  const limit = rateLimit("app-stores", clientIp(request), LIMITS.api);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const stores = await getStores();

  const previews = await Promise.all(
    stores.map(async (store) => {
      if (store.product_count === 0) return [] as Product[];
      const { products } = await getProductsSafe({
        seller: store.store_slug,
        per_page: PREVIEW_COUNT,
      });
      return products;
    })
  );

  const payload = stores
    .map((store, index) => ({
      id: store.id,
      name: store.store_name,
      slug: store.store_slug,
      logo: appImage(store.logo, 256),
      color: store.store_color,
      productCount: store.product_count,
      since: store.since,
      /* The canonical web URL, because the app's store row opens the store's
         page in a browser rather than reimplementing it. A store page is a
         masthead, a policy block and a filtered grid; the app already has the
         grid on its Shop screen and the rest is reading. */
      url: absolute(storeHref(store.store_slug)),
      products: previews[index].map((product) => ({
        id: product.id,
        name: product.name,
        image: appImage(product.image, 256),
      })),
    }))
    .sort((a, b) => b.productCount - a.productCount);

  return Response.json({ stores: payload }, { headers: APP_CACHE_HEADERS });
}
