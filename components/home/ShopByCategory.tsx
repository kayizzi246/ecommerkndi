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

/**
 * The card tints, cycled across the grid.
 *
 * Six rather than twelve: past six the eye stops reading them as a set and
 * starts reading them as noise, and with twelve cards each colour lands twice,
 * which is enough separation to scan by without turning the row into a
 * paintbox.
 *
 * Every one is the palest step of a hue the shop already owns, at the same
 * 96-97% luminance the rest of this page's tints use — see the accent-shelf
 * note in globals.css. Pale enough that a white product disc sits on them
 * without a visible edge, distinct enough to tell apart at a glance.
 *
 * `text` is only ever used by the lettered fallback, which sits on the tint
 * rather than on the white disc and so needs the darker step of the same hue.
 */
const TINTS = [
  { card: "bg-[#eef2fd]", text: "text-pop-blue" },
  { card: "bg-[#fdeef5]", text: "text-pop-pink" },
  { card: "bg-[#ecf8f0]", text: "text-shop-save" },
  { card: "bg-[#fdf3e6]", text: "text-shop-primary-ink" },
  { card: "bg-[#f2efFd]", text: "text-pop-violet" },
  { card: "bg-[#e9f5f7]", text: "text-pop-blue" },
] as const;

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
    <section aria-labelledby="departments-heading" className="shop-panel shop-panel-categories">
      {/* "Shop by category", not "Shop by department", and the rename is not
          cosmetic: the footer already ships an `<h2>Shop by department</h2>` on
          every page of the shop, so this section was giving the homepage two
          identical second-level headings. Duplicate headings make a page
          outline ambiguous to a crawler and to anyone moving through it by
          heading — and the two lists are genuinely different, since the footer
          holds departments while this holds departments AND their widest child
          categories.

          The subtitle names what the shop actually sells. It read "Every aisle
          in the shop, one tap away", which is true and says nothing a search
          engine or a first-time visitor can use; the categories themselves are
          images and link text, so this line is the one place above the fold
          that states the range in a sentence. */}
      <SectionHeader
        id="departments-heading"
        title="Shop by category"
        subtitle="Shoes, fashion, electronics and home — delivered countrywide"
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
      {/* ---- Coloured cards, where this was a strip of white circles ----

          The circles were the reference's shape and they had two problems the
          shop asked to be rid of. They were monochrome — one violet repeated
          twelve times, so the row read as a texture rather than as twelve
          destinations — and a circle inscribed in its tile throws away the four
          corners, which is most of the space a category thumbnail has.

          A card uses all of it, and giving each one its own colour turns the
          row into the most scannable block on the page: a returning shopper
          finds their aisle by colour before they have read a word. That is what
          a category grid is for, and it is what the coloured department shelves
          further down already do at full strength — this is the same idea at
          tint strength, which is why the two do not fight.

          The colours cycle through a fixed six rather than being keyed to a
          category name. Names come from wp-admin and change; a modulo over the
          rendered order cannot break, cannot collide, and gives an even spread
          whatever the shop calls its aisles. It does mean a category can change
          colour when another is added before it — acceptable for decoration,
          which is all this is.

          A grid rather than the scrolling strip it replaced: with twelve
          coloured cards the row is the page's map, and a map that has to be
          swiped is a map half of which is never seen. Three tidy phone rows is
          the right cost for that.  */}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {tiles.map((category, index) => {
          /* The shop's own category artwork wins where it exists; otherwise a
             real product photograph from that category, picked by the feed. See
             `collectCategoryImages` in lib/home-feed.ts for why that pick is
             stable rather than random. */
          const image = category.image || categoryImages[category.id] || null;
          const tint = TINTS[index % TINTS.length];

          return (
            <li key={category.id}>
              <Link
                href={`/category/${category.slug}`}
                className={`group flex h-full flex-col items-center gap-2 rounded-2xl p-3 text-center transition-transform duration-200 hover:-translate-y-0.5 ${tint.card}`}
              >
                {/* The photograph sits on a white disc INSIDE the coloured
                    card. Almost every image in this catalogue is a JPEG shot on
                    white, so putting one straight onto a tint paints an opaque
                    white rectangle over it — the exact seam that took the
                    violet out of the circles a version ago. A white disc is
                    honest about that: the photograph's own background and the
                    disc are the same colour, so there is no edge to see, and
                    the tint stays visible around it where nothing can paint
                    over it. */}
                <span className="relative block aspect-square w-full max-w-[76px] overflow-hidden rounded-full bg-white shadow-sm">
                  {image ? (
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 96px"
                      quality={90}
                      className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={`flex h-full w-full items-center justify-center text-[24px] font-bold ${tint.text}`}
                    >
                      {category.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>

                {/* Ink, not the card's own hue. The tints are pale enough that
                    coloured type on them drops under AA at 12px, and the colour
                    is already doing its job as the ground — a name is for
                    reading. */}
                <span className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-shop-ink md:text-[12.5px]">
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
