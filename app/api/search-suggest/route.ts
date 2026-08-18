import { NextResponse } from "next/server";
import { getProductsSafe, getStores } from "@/lib/woocommerce";

/** Stores in the panel are a shortcut, not a directory — three is the ceiling. */
const STORE_LIMIT = 3;

/**
 * Ranks a store name against what has been typed.
 *
 * Lower is better, and the ordering is the point: a shopper who types "sports"
 * means the store called "Sports Kicks" before the one called "City Sports and
 * More", because a name that STARTS with the term is far more likely to be the
 * thing being reached for. Anything that does not contain the term at all is
 * dropped by the caller rather than ranked last.
 */
function storeRank(name: string, term: string): number {
  const at = name.toLowerCase().indexOf(term);
  if (at === -1) return -1;
  // An exact name wins outright, then a prefix, then position in the string.
  if (name.toLowerCase() === term) return 0;
  return at === 0 ? 1 : 2 + at;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [], stores: [] });
  }

  // ---- Products and stores together, in parallel ----
  //
  // The panel used to answer only "what is this called", but half of what gets
  // typed into a marketplace search box is a SHOP name — someone who bought
  // once and is coming back for the same seller, or who saw the store on a
  // parcel. Sending them to a product grid filtered by a keyword that happens
  // to match the store's merchandise was the wrong answer to a question they
  // had asked precisely.
  //
  // `getStores` is a cached read of the whole (small) store list, so matching
  // happens here rather than as a second WordPress query — there is no store
  // search endpoint, and adding one for a list this size would be slower than
  // filtering it. If this shop ever has hundreds of stores, this is the line
  // that has to become a real query.
  const term = q.toLowerCase();
  const [{ products }, allStores] = await Promise.all([
    getProductsSafe({ search: q, per_page: 6 }),
    getStores(),
  ]);

  const stores = allStores
    .map((store) => ({ store, rank: storeRank(store.store_name, term) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || b.store.product_count - a.store.product_count)
    .slice(0, STORE_LIMIT)
    .map(({ store }) => ({
      name: store.store_name,
      slug: store.store_slug,
      logo: store.logo,
      product_count: store.product_count,
    }));

  return NextResponse.json({
    suggestions: products.map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      price: p.price,
      regular_price: p.regular_price,
      on_sale: p.on_sale,
      category: p.categories[0]?.name ?? "",
    })),
    stores,
  });
}
