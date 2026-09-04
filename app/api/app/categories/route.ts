import { getCategories, getProductsSafe, buildCategoryTree, type CategoryNode } from "@/lib/woocommerce";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { appImage, APP_CACHE_HEADERS } from "@/lib/app-api";

/**
 * The department tree with a picture on every shelf, for the app's Categories
 * screen.
 *
 * ## Why not `/api/categories`
 *
 * That endpoint exists and is public, but it answers a different question: it
 * is a flat list of terms for a picker — the seller's category dropdown — and
 * it carries no images and no shape. The app's Categories screen is the
 * two-pane browser the phone web build serves: a rail of departments down the
 * left and that department's shelves as photographs on the right. A flat list
 * would make the phone rebuild the tree and then leave every tile grey.
 *
 * ## The pictures are the whole point, and they are borrowed
 *
 * A WooCommerce category has an image field and on this catalogue almost
 * nothing fills it in. So a shelf with no image of its own borrows the first
 * product filed anywhere beneath it — which is a better tile than a designed
 * icon would be, because it shows what is actually in stock today.
 *
 * That costs one catalogue read per department, in parallel, exactly as the
 * website's `/categories` page does it. `getProductsSafe` on each, so a
 * department WordPress cannot answer for loses its pictures rather than taking
 * the screen down.
 *
 * ## Two levels of shelf
 *
 * Children and grandchildren, flattened into one ordered list per department,
 * each shelf followed by its own sub-shelves. Three levels is the whole tree on
 * this shop, and the grandchildren are where a shopper's words live — nobody
 * searches for "Shoes", they want Sandals. The parent/child relationship
 * survives in `depth` so the app can set the deeper ones smaller without having
 * to re-derive the tree.
 */

export const revalidate = 300;

/** How much of a department is read to find pictures for its shelves. */
const PER_DEPARTMENT = 48;

/** Products returned per department, for the grid under the tiles. */
const FEATURED = 12;

type AppShelf = {
  name: string;
  slug: string;
  image: string;
  /** 1 for a shelf, 2 for a sub-shelf. */
  depth: number;
  count: number;
};

export async function GET(request: Request) {
  const limit = rateLimit("app-categories", clientIp(request), LIMITS.api);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const categories = await getCategories();
  const departments = buildCategoryTree(categories);

  const feeds = await Promise.all(
    departments.map((department) =>
      getProductsSafe({
        category: department.slug,
        per_page: PER_DEPARTMENT,
        sort: "popular",
      })
    )
  );

  const payload = departments.map((department, index) => {
    const products = feeds[index].products;

    const shelves: AppShelf[] = department.children
      .flatMap((child) => [
        { node: child, depth: 1 },
        ...child.children.map((grandchild) => ({ node: grandchild, depth: 2 })),
      ])
      .map(({ node, depth }) => {
        const wanted = new Set(subtreeSlugs(node));
        const hit = products.find((product) =>
          product.categories.some((category) => wanted.has(category.slug))
        );
        return {
          name: node.name,
          slug: node.slug,
          image: appImage(node.image || hit?.image || "", 256),
          depth,
          count: node.count ?? 0,
        };
      });

    return {
      id: department.id,
      name: department.name,
      slug: department.slug,
      image: appImage(department.image || products[0]?.image || "", 256),
      count: department.count ?? 0,
      shelves,
      /* A department's own goods, so the screen ends in merchandise rather
         than in labels. Only what a tile needs — this is a browse screen, and
         the full product shape is what `/api/app/products` is for. */
      products: products.slice(0, FEATURED).map((product) => ({
        id: product.id,
        name: product.name,
        image: appImage(product.image, 256),
      })),
    };
  });

  return Response.json({ departments: payload }, { headers: APP_CACHE_HEADERS });
}

function subtreeSlugs(node: CategoryNode): string[] {
  return [node.slug, ...node.children.flatMap(subtreeSlugs)];
}
