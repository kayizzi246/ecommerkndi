"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Product } from "@/lib/woocommerce";
import { arrangeProducts } from "@/lib/arrange-feed";
import { readInterests, topInterests, type Interests } from "@/lib/interests";

/**
 * The loader behind every infinite grid in the shop.
 *
 * ---- Why this is a hook and not a component ----
 *
 * Four grids scroll forever now — the homepage, /sale, /search and a category —
 * and they do not all draw the same thing. The sale page groups its products
 * into discount bands and has to re-group them every time more arrive; the
 * others are a flat grid. If the paging lived inside the grid COMPONENT, the
 * sale board would have had to reimplement the fetch, the page counter, the
 * de-duplication, the observer and the three failure states, and the day one of
 * those was fixed it would have been fixed in one of two places.
 *
 * So the paging lives here and the grids only decide what a page of products
 * looks like once it has arrived.
 *
 * ---- What it guarantees ----
 *
 *   • No product is ever appended twice, however WooCommerce paginates. Sorting
 *     by price while stock changes underneath can genuinely return the same row
 *     on two pages, and a React list with a duplicate key is a rendering bug
 *     rather than a cosmetic one.
 *   • A failed page stops the observer instead of retrying forever. A shop on a
 *     dropped connection would otherwise fire a request per scroll frame.
 *   • `done` is the server's own page count, so the grid stops claiming there is
 *     more when there is not.
 */

/** The listing this feed is a page of. Mirrors `/api/products`. */
export type ProductFeedQuery = {
  category?: string;
  /** The search term, for /search. */
  q?: string;
  seller?: string;
  sort?: string;
  onSale?: boolean;
  inStock?: boolean;
  minPrice?: string;
  maxPrice?: string;
};

function feedUrl(page: number, perPage: number, query: ProductFeedQuery): string {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });

  if (query.category) params.set("category", query.category);
  if (query.q) params.set("q", query.q);
  if (query.seller) params.set("seller", query.seller);
  if (query.sort) params.set("sort", query.sort);
  if (query.onSale) params.set("on_sale", "1");
  if (query.inStock) params.set("in_stock", "1");
  if (query.minPrice) params.set("min_price", query.minPrice);
  if (query.maxPrice) params.set("max_price", query.maxPrice);

  return `/api/products?${params.toString()}`;
}

export type ProductFeed = {
  products: Product[];
  loading: boolean;
  failed: boolean;
  /** Every page the server has has been fetched. */
  done: boolean;
  loadMore: () => void;
  /** Attach to an element below the grid; reaching it fetches the next page. */
  sentinel: RefObject<HTMLDivElement | null>;
};

export function useProductFeed({
  initialProducts,
  totalPages,
  query,
  perPage = 24,
  startPage = 1,
  excludeId,
  refine,
  personalize = false,
}: {
  /** The page the server rendered — usually page one. */
  initialProducts: Product[];
  /** The server's own page count for this listing. */
  totalPages: number;
  query: ProductFeedQuery;
  perPage?: number;
  /**
   * Which page `initialProducts` is, so the feed continues from there.
   *
   * Almost always 1. It exists because the listing pages honoured a `?page=`
   * parameter before they became infinite, and those URLs are in Google and in
   * people's history: arriving on `/sale?page=3` should carry on from page four
   * rather than silently re-fetching page two and appending products the
   * shopper is already looking at.
   */
  startPage?: number;
  /** The product whose page this grid is on, kept out of its own suggestions. */
  excludeId?: number;
  /**
   * A last refinement over a freshly fetched page, applied client-side.
   *
   * This exists for the handful of filters WooCommerce cannot express — the
   * brand facet and the minimum-discount slider are both comparisons the server
   * pages already make in `filterProducts` AFTER fetching. Without the same pass
   * here, scrolling a filtered category would append unfiltered products under a
   * heading that says otherwise.
   *
   * It must be a stable function or the effect below re-subscribes on every
   * render; callers wrap it in `useCallback`.
   */
  refine?: (products: Product[]) => Product[];
  /**
   * Mix and personalise the order (`lib/arrange-feed.ts`): categories are
   * scattered so neighbours differ, and the shopper's favourite categories
   * turn up more often, with extra products from them blended into each new
   * page. Only for unsorted feeds such as the homepage "For you" grid — a
   * listing the shopper sorted by price must stay in that order.
   */
  personalize?: boolean;
}): ProductFeed {
  /* Pure scatter on the first render, which needs no browser data, so the
     server and the browser agree on the first page. */
  const [products, setProducts] = useState(() =>
    personalize ? arrangeProducts(initialProducts, null) : initialProducts
  );
  /** The shopper's interests, read once when the grid mounts. */
  const interests = useRef<Interests | null>(null);
  /** Products from their favourite categories, waiting to be blended in. */
  const boostPool = useRef<Product[]>([]);

  useEffect(() => {
    if (!personalize) return;
    const read = readInterests();
    const favourites = topInterests(read, 2);
    if (favourites.length === 0) return;
    interests.current = read;

    // The first page is re-dealt with their interests once, straight after
    // load, before the grid has usually been scrolled to. Later pages are
    // arranged as they arrive, so a tile never moves once it is on screen.
    let cancelled = false;
    // On the next frame rather than inside the effect body: the interests come
    // from browser storage, an outside source, and the result is applied the
    // way any subscription's callback would apply it.
    const frame = requestAnimationFrame(() => {
      if (!cancelled) setProducts((current) => arrangeProducts(current, read));
    });

    Promise.all(
      favourites.map((slug) =>
        fetch(feedUrl(1, 12, { category: slug }))
          .then((response) => (response.ok ? response.json() : { products: [] }))
          .then((payload: { products?: Product[] }) => payload.products ?? [])
          .catch(() => [] as Product[])
      )
    ).then((lists) => {
      if (cancelled) return;
      // Alternate between the favourite categories rather than all of one first.
      const merged: Product[] = [];
      for (let i = 0; i < 12; i++) {
        for (const list of lists) if (list[i]) merged.push(list[i]);
      }
      boostPool.current = merged.filter(
        (product) => product.id !== excludeId && product.stock_status !== "outofstock"
      );
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // Once per mount: the grid is keyed by its tab, so a new feed remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [page, setPage] = useState(startPage);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const done = page >= totalPages;

  /* ---- The query has to be stable by VALUE, not by identity ----

     Every caller writes it inline — `query={{ onSale: true, sort }}` — so the
     object is a fresh reference on every render. Depended on directly it would
     rebuild `loadMore` each render, which would tear down and re-create the
     IntersectionObserver each render, which on a grid already at the bottom of
     the page means firing the sentinel again on every state change. That is a
     request loop with no visible cause.

     Serialising is the cheap fix and it is exact here: this object is a handful
     of strings and booleans with no order ambiguity, since it is built by this
     module's own type rather than assembled from user input. */
  const queryKey = JSON.stringify(query);
  const stableQuery = useMemo(() => JSON.parse(queryKey) as ProductFeedQuery, [queryKey]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);
    setFailed(false);

    try {
      const next = page + 1;
      const response = await fetch(feedUrl(next, perPage, stableQuery));
      if (!response.ok) throw new Error(String(response.status));

      const payload = (await response.json()) as { products: Product[] };
      const arriving = refine ? refine(payload.products) : payload.products;

      // Taken out of the pool before the state update, so a re-run of the
      // updater (React may call it twice in development) cannot lose them.
      const boosted = personalize ? boostPool.current.splice(0, 4) : [];

      setProducts((current) => {
        const seen = new Set(current.map((product) => product.id));
        const fresh = [...arriving, ...boosted].filter((p) => {
          if (seen.has(p.id) || p.id === excludeId) return false;
          seen.add(p.id);
          return true;
        });
        return [
          ...current,
          ...(personalize ? arrangeProducts(fresh, interests.current, current) : fresh),
        ];
      });
      setPage(next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, page, perPage, stableQuery, excludeId, refine, personalize]);

  useEffect(() => {
    const node = sentinel.current;
    // Nothing left to fetch, or the last attempt failed — in which case the
    // shopper gets a button rather than a loop of doomed requests.
    if (!node || done || failed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      // Fetched 600px early, so the next row is usually already there by the
      // time the shopper reaches the bottom of the current one.
      { rootMargin: "600px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, done, failed]);

  return { products, loading, failed, done, loadMore, sentinel };
}
