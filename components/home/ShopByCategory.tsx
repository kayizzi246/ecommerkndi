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

  /* ---- Deduplicated by NAME, not just by id ----
   *
   * An id check alone was not enough and the page showed exactly why: this
   * catalogue files "Shoes" under both Men and Women, "Hoodies" under both, and
   * "Jewelry" twice over. Those are genuinely different terms with different
   * ids, so an id-keyed set let every one of them through, and the strip
   * rendered "Shoes … Shoes … Hoodies … Hoodies" — which reads as a bug to a
   * shopper whatever the taxonomy says, because two tiles with the same word
   * under them are indistinguishable at a glance.
   *
   * Keying on the lower-cased name collapses them to the first occurrence, and
   * `children` is already sorted widest-first, so the survivor is the one with
   * the most stock behind it. That is the right one to keep: a shopper tapping
   * "Shoes" wants the biggest shoe aisle, not whichever branch sorted first.
   *
   * The id stays in the set as well, for the separate case of a shop that has
   * filed a category under itself and so repeats a department among its own
   * children.
   */
  const seenIds = new Set(tops.map((item) => item.id));
  const seenNames = new Set(tops.map((item) => item.name.trim().toLowerCase()));

  const extra = children.filter((item) => {
    const name = item.name.trim().toLowerCase();
    if (seenIds.has(item.id) || seenNames.has(name)) return false;
    seenIds.add(item.id);
    seenNames.add(name);
    return true;
  });

  return [...tops, ...extra];
}

export default function ShopByCategory({
  departments,
  categoryImages = {},
}: {
  departments: CategoryNode[];
  /** A product photograph per category id, from `buildHomeFeed`. */
  categoryImages?: Record<number, string>;
}) {
  const tiles = toTiles(departments).slice(0, SHOWN);

  /* Under four this is a strip that failed to fill rather than a section, and a
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

      {/* ---- A scrolling strip, where this was a wrapping grid ----

          The grid was chosen on the argument that a track ending after one
          swipe promises more than it holds, and that a signpost should put
          every destination on screen at once. Both are true of a row of EIGHT
          departments. They stop being true at twelve and beyond: three stacked
          rows of tiles is no longer a signpost, it is a page of navigation
          above the merchandise, which is the thing this page's layout rule
          exists to prevent.

          A strip costs one row of height whatever the catalogue grows to. The
          shop asked for the arrangement the large marketplaces use here and
          that is the reason they use it — the category row is the one block on
          a marketplace homepage that must not grow with the catalogue.

          `overflow-x-auto` with `no-scrollbar`, the same track the product
          rails use, so the whole page scrolls one way and the shelves scroll
          the other. A tile cut by the right edge is what says there is more.

          It is markup-only: no arrows, no state, no `"use client"`. The rails
          need a client component because they have scroll buttons and a
          disabled state to track; a category strip is short enough to swipe or
          flick, and adding a client bundle to the top of the homepage for two
          chevrons would cost more than it buys. */}
      <ul className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar sm:gap-3">
        {tiles.map((category) => {
          /* The shop's own category artwork wins where it exists; otherwise a
             real product photograph from that category, picked by the feed.
             See `collectCategoryImages` in lib/home-feed.ts for why that pick
             is stable rather than random. */
          const image = category.image || categoryImages[category.id] || null;

          return (
            /* Fixed widths rather than a fraction of the container: a strip
               sized in percentages shows a different number of tiles at every
               breakpoint and never quite cuts one at the edge, which is what
               tells a shopper to swipe. 96px on a phone puts three and a half
               tiles on a 390px screen; 128 from `sm` is the size the labels
               below need before two-word names start wrapping to three lines. */
            <li key={category.id} className="w-[96px] shrink-0 sm:w-[128px]">
              <Link href={`/category/${category.slug}`} className="group block">
                {/* ---- The picture sits in a tinted well ----

                    A square tile with a soft ground and the photograph inside
                    it, which is the arrangement every large marketplace uses
                    for this row. The tint matters: these are product cut-outs
                    shot on white, so on a white panel they would float with no
                    edge at all, and the well is what turns a photograph into a
                    tile.

                    `object-contain` with padding, NOT `object-cover`. A
                    category tile is showing one representative object and a
                    cover crop would slice it — this is the opposite case from
                    the product grid, where the photograph IS the tile and
                    filling the box is right.

                    The ground lifts to the brand's soft tint on hover rather
                    than the tile moving, so a strip of twelve never shifts
                    under the pointer. */}
                <span className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-shop-hairline ring-1 ring-shop-line-warm transition-colors group-hover:bg-shop-primary-soft group-hover:ring-shop-primary">
                  {image ? (
                    <Image
                      src={image}
                      alt=""
                      fill
                      /* The tile is 96px on a phone and 128 above it, so the
                         browser is told the real box rather than being left to
                         fetch a full-viewport file for a thumbnail. */
                      sizes="(max-width: 640px) 96px, 128px"
                      quality={90}
                      className="object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    /* The last resort, and it now really is one: the feed
                       supplies a photograph for any category the catalogue has
                       stock in, so a lettered tile means an empty aisle. */
                    <span
                      aria-hidden
                      className="flex h-full w-full items-center justify-center text-[26px] font-bold text-shop-primary-ink"
                    >
                      {category.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>

                {/* Under the tile rather than on it. A label burned into the
                    corner of a photograph is unreadable against whatever the
                    photograph happens to be there; underneath, on the panel, it
                    is ink on white every time.

                    Two lines then clamped: names run from "Men" to "Home &
                    Living", and truncating to "Home &…" would be least legible
                    exactly where it is least obvious what was cut. */}
                <span className="mt-2 block text-center text-[11.5px] font-semibold leading-tight text-shop-ink transition-colors line-clamp-2 group-hover:text-shop-primary md:text-[12.5px]">
                  {category.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
