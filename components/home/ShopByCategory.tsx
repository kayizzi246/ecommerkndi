import Link from "next/link";
import Image from "next/image";
import type { CategoryNode } from "@/lib/woocommerce";
import SectionHeader from "@/components/home/SectionHeader";

/**
 * The catalogue's own structure, as a grid of tiles under the banner.
 *
 * ---- This is the fourth attempt at this row, and the first one answering a
 *      real question ----
 *
 * It was department chips, then `CategoryCircles`, then a category card grid,
 * and every one was deleted with the same verdict: nobody could say what it was
 * for that the masthead was not already doing. That verdict was right every
 * time. The department bar sat on every page, the mega-menu listed the children
 * too, and a shortcut row wedged between two blocks of merchandise was the
 * shallower of two routes to the same place.
 *
 * It stopped being right when the department bar came out of the masthead below
 * `md`. A phone now reaches the catalogue's structure through the hamburger and
 * nothing else, so this is not a second route any more — on the shop's majority
 * device it IS the department bar, moved into the page and given pictures.
 *
 * ---- Why it sits above the merchandise ----
 *
 * Against the page's own rule, knowingly. The rule exists because four blocks
 * of navigation once stacked here and pushed the first product below the fold;
 * the case was never that navigation is worthless, it was that FOUR of them
 * cost a screen. This is one block, and on a phone it is the only navigation on
 * the page.
 *
 * A shopper arriving with an intent — shoes, a phone, something for the kids —
 * decides in the first screen whether this shop stocks their category at all,
 * and a grid of named categories answers that faster than four rails of
 * individual products. A shopper arriving to browse ignores it and scrolls into
 * Trending, directly below.
 *
 * ---- Departments first, then children ----
 *
 * The first version listed top-level departments only. On this shop that is
 * four tiles — Men, Women, Home Decor, Kids — which is a thin row and, worse, a
 * misleading one: it says the catalogue holds four things when the tree
 * underneath holds dozens.
 *
 * So the grid is built in two passes. Every department goes in first, in the
 * shop's own order, because a department is the entry a shopper is most likely
 * to be looking for. Then the children are appended, widest first, until the
 * grid is full. The ordering matters — interleaving would put "Boots" above
 * "Women" — and taking the widest children first sends the spare slots to the
 * sections that actually have stock behind them rather than to whichever branch
 * happens to sort first.
 *
 * ---- It costs no fetch ----
 *
 * `buildHomeFeed` has always returned `departments`, the same tree the layout
 * hands the mega-menu and deduplicated by Next within one render. This renders
 * a field the shop was already paying for.
 */

/**
 * Tiles drawn before the grid stops.
 *
 * Twelve: three full rows on a phone at four across, two rows from `sm`. It is
 * a deliberate cap rather than "show everything" — a shop that grows to sixty
 * categories must not get a sixty-tile wall above its merchandise, and "All
 * categories" in this section's own header is the honest route to the rest.
 */
const SHOWN = 12;

/** A tile's worth of category, flattened out of the tree. */
type Tile = {
  id: number;
  name: string;
  slug: string;
  image?: string | null;
  count: number;
};

/**
 * Flattens the tree into the grid's order: departments first, then the widest
 * children.
 *
 * A node with no slug cannot be linked and is dropped at both levels. `count`
 * is optional in WooCommerce's payload and is read as zero only for SORTING —
 * never as a reason to hide a category. That distinction is the lesson of the
 * seller row that used to sit further down this page: it tested
 * `product_count > 0` against an install that sends no count, read every store
 * as empty, and disappeared silently for months.
 */
function toTiles(departments: CategoryNode[]): Tile[] {
  const linkable = (node: CategoryNode) => Boolean(node.slug);
  const tile = (node: CategoryNode): Tile => ({
    id: node.id,
    name: node.name,
    slug: node.slug,
    image: node.image,
    count: node.count ?? 0,
  });

  const tops = departments.filter(linkable).map(tile);

  const children = departments
    .flatMap((department) => department.children ?? [])
    .filter(linkable)
    .map(tile)
    /* Widest first, so the slots left after the departments go to the sections
       with the most behind them. Ties keep WooCommerce's own order, which
       `sort` preserves. */
    .sort((a, b) => b.count - a.count);

  /* A child can repeat a department's id on a shop that has filed a category
     under itself, and a duplicate tile is the kind of thing nobody catches in
     review and everybody catches on the page. */
  const seen = new Set(tops.map((item) => item.id));
  return [...tops, ...children.filter((item) => !seen.has(item.id))];
}

export default function ShopByCategory({
  departments,
}: {
  departments: CategoryNode[];
}) {
  const tiles = toTiles(departments).slice(0, SHOWN);

  /* Under four this is a grid that failed to fill rather than a section, and a
     shop with three categories has a masthead already showing all three. */
  if (tiles.length < 4) return null;

  return (
    <section aria-labelledby="departments-heading" className="shop-panel">
      <SectionHeader
        id="departments-heading"
        title="Shop by department"
        subtitle="Every aisle in the shop, one tap away"
        href="/categories"
        linkLabel="All categories"
      />

      {/* Four across on a phone, up to eight from `lg`.
          Not a scrolling strip: twelve tiles fit three phone rows with no
          interaction to learn, and a track that ends after one swipe promises
          more than it holds. A grid also puts every category on screen at once,
          which is the entire job of a signpost. */}
      <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 lg:grid-cols-8">
        {tiles.map((category) => (
          <li key={category.id}>
            <Link
              href={`/category/${category.slug}`}
              className="group flex flex-col items-center gap-1.5 text-center"
            >
              {/* ---- A rounded square, where this was a circle ----

                  The circles were borrowed from the seller row, where they are
                  right: a store is a brand and a brand mark is round. A
                  category is a shelf, and every marketplace this shop is
                  measured against draws its category grid as squares — because
                  a square holds a product photograph without cropping the
                  corners off it, and most category images ARE product
                  photographs.

                  It also buys the row its density back. A circle inscribed in
                  the tile's width wastes four corners, so the artwork had to be
                  small; at the same tile width a `rounded-2xl` square shows
                  noticeably more picture, which is what lets twelve of these
                  sit where eight circles did without the row feeling cramped.

                  ---- The fallback is the normal case ----

                  A category image is optional in WooCommerce and most shops
                  never set one, so the lettered tile is what most of these
                  render. A broken image is worse than no image, and a tinted
                  square with a letter in it reads as a designed mark rather
                  than as a photograph that failed to load.

                  `bg-shop-primary-soft` with `shop-primary-ink` on it is the
                  shop's standard small-orange-on-light pairing at 5.9:1. The
                  ring tightens on hover rather than the tile scaling, so a grid
                  of twelve never shifts under the pointer. */}
              <span className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-shop-primary-soft ring-1 ring-shop-line-warm transition-all group-hover:ring-2 group-hover:ring-shop-primary">
                {category.image ? (
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    /* The tile is a twelfth of the shell at most and a quarter
                       of a phone screen at least, so the browser is told the
                       real box rather than being left to fetch a full-viewport
                       file for a thumbnail. */
                    sizes="(max-width: 640px) 23vw, (max-width: 1024px) 15vw, 120px"
                    quality={90}
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-full w-full items-center justify-center text-[26px] font-bold text-shop-primary-ink"
                  >
                    {category.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </span>

              {/* Two lines allowed, then clamped. Names here run from "Men" to
                  "Home & Living", and truncating the long ones to "Home &…"
                  would make the row unreadable exactly where it is least
                  obvious what was cut. */}
              <span className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-shop-ink transition-colors group-hover:text-shop-primary md:text-[12.5px]">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
