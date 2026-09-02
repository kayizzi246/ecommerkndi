import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStores } from "@/lib/woocommerce";
import { storeSlugFromPath } from "@/lib/store-routes";
import StorePage, {
  generateMetadata as storeMetadata,
} from "@/app/sellers/[slug]/page";

/**
 * A store at the root of the domain: kandiug.com/sports-kicks
 *
 * ---- Why this exists ----
 *
 * Sellers market these links by hand. The address goes on a flyer, into a
 * WhatsApp status, onto the side of a boda, and gets read out over a phone —
 * and "kandiug.com slash sellers slash sports kicks" is two words longer than
 * anybody will repeat accurately. The short form is the one a seller can
 * actually spend money printing.
 *
 * ---- Why a root-level dynamic segment is safe here ----
 *
 * It looks alarming: a `[store]` at the top level appears to swallow the whole
 * site. It does not, because Next resolves a static segment before a dynamic
 * one — /cart, /checkout, /search and every other real page keep winning on
 * their own paths, and this only ever sees what is left over.
 *
 * What is left over is either a store slug or a typo, and the guard below is
 * what keeps the second from becoming the first. `RESERVED` mirrors the list
 * WordPress refuses to issue as a slug: WordPress is the one that decides, and
 * this exists so that a name which slipped through — or a route added to the
 * shop after a store had already claimed it — 404s cleanly rather than
 * rendering an empty shop at an address the site itself wants.
 *
 * ---- On having two URLs for one page ----
 *
 * /sellers/<slug> still works, because it is in circulation and in Google's
 * index. It is not a duplicate as far as a crawler is concerned: the canonical
 * on both points at this short form, which is also the URL the Seller Centre
 * hands sellers to share. One page, one canonical address, two ways in.
 */
type Params = { params: Promise<{ store: string }> };

/** True when this path could be a store rather than something the shop owns. */
async function resolve(slug: string): Promise<boolean> {
  // The reserved list and the shape check both live in lib/store-routes, so the
  // chrome and this route cannot disagree about what a store address looks
  // like. They did once, and every short link paid for it. Existence is checked
  // here and only here, because it costs a fetch.
  if (storeSlugFromPath(`/${slug}`) === "") return false;

  const stores = await getStores();
  return stores.some((entry) => entry.store_slug === slug);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { store } = await params;
  if (!(await resolve(store))) return { title: "Not found" };

  return storeMetadata({ params: Promise.resolve({ slug: store }) });
}

/**
 * The stores that exist at build time get a static page each; anything opened
 * afterwards is rendered on demand and cached from then on. Same treatment
 * /sellers/[slug] already gets, for the same reason — a store page is a
 * catalogue and does not change between visits.
 */
export async function generateStaticParams() {
  const stores = await getStores();
  return stores
    .filter((entry) => storeSlugFromPath(`/${entry.store_slug}`) !== "")
    .map((entry) => ({ store: entry.store_slug }));
}

export default async function ShortStorePage({ params }: Params) {
  const { store } = await params;

  if (!(await resolve(store))) {
    notFound();
  }

  // The same component, given the same argument under the name it expects.
  // Re-implementing the page here would mean two store pages to keep in step,
  // and they would not stay in step.
  return StorePage({ params: Promise.resolve({ slug: store }) });
}
