import type { Metadata } from "next";
import Link from "next/link";
import {
  getCategories,
  getProductsSafe,
  buildCategoryTree,
  type CategoryNode,
} from "@/lib/woocommerce";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import CategoryShelves, { type Shelf } from "@/components/CategoryShelves";
import CategoryBrowser, { type BrowseDepartment } from "@/components/CategoryBrowser";
import ProductCard from "@/components/ProductCard";

export const metadata: Metadata = {
  title: "All categories",
  description:
    "Every department on KandiUg — browse clothing, shoes, electronics, home and more from Ugandan sellers.",
  alternates: { canonical: "/categories" },
};

/**
 * How much of a department this page pulls.
 *
 * 48 is a rail's worth several times over, and it has to be, because the shelf
 * tabs are filters over this one feed rather than requests of their own (the
 * argument is in `CategoryShelves`). A department with eight shelves needs
 * enough in hand that the thinnest of them still has something to show, and
 * anything past 48 is stock nobody swipes to.
 */
const PER_DEPARTMENT = 48;

/**
 * Every department on the shop, as merchandise rather than as a table of
 * contents.
 *
 * ---- What this page was, and why it is not that any more ----
 *
 * It was an index: a warm masthead with a product count, then a two-up grid of
 * department cards, each listing its shelves and the sub-shelves under them as
 * text. That was a genuinely good version of the wrong thing. Every word on it
 * was a category name, and a shopper cannot tell from the word "Sandals"
 * whether this shop has sandals worth buying — so the page's whole job was to
 * send them somewhere else to find out, and it was judged by how quickly it
 * could get rid of them.
 *
 * A shop's own browse page should sell. So: one section per department,
 * scrolled through rather than scanned, and each section is the department's
 * name, its shelves as tabs, and its actual products in a rail underneath. The
 * tabs change the rail in place, so four shelves can be looked at from a
 * standstill — which is the thing a list of links could never do, and the
 * reason the links were not worth keeping as the primary content.
 *
 * ---- The link index at the foot is gone ----
 *
 * "Every shelf" — the whole tree as small text links under the rails — was
 * asked off the page. It was there because the shelf tabs are buttons and a
 * crawler cannot press one, so it was the page's only crawlable path into the
 * tree.
 *
 * What replaced it is not nothing. The phone browser's tiles are real `<a>`s
 * and now carry two levels — every shelf and every sub-shelf under it — so the
 * same slugs are still linked from this page's markup; they are simply
 * pictures instead of a list. The `ItemList` JSON-LD below still declares the
 * whole three-level tree either way.
 *
 * The thing genuinely lost is the desktop half: above `md` the browser is
 * hidden, so a crawler rendering a wide viewport sees tabs and rails only. If
 * category indexing ever softens, that is the first place to look, and the fix
 * is to make the tabs links rather than to bring the footer list back.
 *
 * ---- Cost ----
 *
 * One request per department on top of the category tree, in parallel. That is
 * four on this catalogue against the one the old page made, and it is the
 * price of a page that shows goods instead of naming them. `getProductsSafe`
 * on each, so a department WordPress cannot answer for drops out of the page
 * rather than taking the page down with it.
 */
export default async function CategoriesPage() {
  const categories = await getCategories();
  const departments = buildCategoryTree(categories);

  const feeds = await Promise.all(
    departments.map((department) =>
      getProductsSafe({
        category: department.slug,
        per_page: PER_DEPARTMENT,
        // The department's best stock first. A browse page opening on whatever
        // WooCommerce returns by default is a browse page opening on the least
        // interesting thing in the department.
        sort: "popular",
      })
    )
  );

  /**
   * The phone's two-pane browser, built from the same two requests the rails
   * are built from.
   *
   * Every department is offered here, including one whose feed came back empty
   * — the rail is a table of contents and a department missing from it reads as
   * a shop that does not stock the thing, which is a different and worse claim
   * than a shelf that happens to be bare today. The rails below drop those; a
   * rail with no products in it is nothing to look at.
   *
   * A shelf tile wants a picture and WooCommerce usually has none: category
   * images are optional and almost nothing on this catalogue has one. So the
   * fallback is the first product filed anywhere under that shelf, taken out of
   * the feed the page already fetched — no extra request, and a shelf shows
   * what is actually on it rather than a grey square.
   */
  const browse: BrowseDepartment[] = departments.map((department, index) => ({
    id: department.id,
    name: department.name,
    slug: department.slug,
    /* Two levels of shelf, not one.
     *
     * This offered the department's direct children only — four or five tiles
     * for Women, where the tree underneath it holds thirty. The grandchildren
     * are where a shopper's actual words live: nobody is looking for "Shoes",
     * they are looking for Sandals, or Heels, or Running Shoes, and a browser
     * that stops one level short makes them tap through to find out whether
     * the shop even files things that way.
     *
     * A shelf is followed immediately by its own sub-shelves, so the grid
     * still reads in groups rather than as one alphabetical soup — the parent
     * is simply the first tile of its own run. Deeper than this is not
     * flattened: three levels is the whole tree, and a fourth would be a list
     * rather than a browser. */
    tiles: [
      ...department.children.flatMap((child) => [child, ...child.children]),
    ].map((shelf) => {
      const wanted = new Set(subtreeSlugs(shelf));
      const hit = feeds[index].products.find((product) =>
        product.categories.some((category) => wanted.has(category.slug))
      );
      return {
        name: shelf.name,
        slug: shelf.slug,
        image: shelf.image || hit?.image || "",
      };
    }),
  }));

  /**
   * The products under each department's tiles, rendered on the server.
   *
   * `ProductCard` is a server component, so the client browser cannot import
   * it — the grids are built here and handed down as nodes, one per
   * department, and the browser picks the one whose rail row is selected. All
   * of them are in the payload either way; the selection is which one is
   * mounted, not which one was fetched.
   *
   * Twelve, not the forty-eight the rails get. This grid is the tail of a
   * screen whose job is navigation: it is there so the department is a place
   * with goods in it rather than a page of labels, and a shopper who wants the
   * rest taps "Shop all", which is directly above it.
   */
  const browseGrids = browse.map((department, index) => {
    const products = feeds[index].products.slice(0, 12);
    if (products.length === 0) return null;
    return (
      <div key={department.id} className="product-grid-flush grid grid-cols-2">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} sizes="45vw" />
        ))}
      </div>
    );
  });

  const sections = departments
    .map((department, index) => ({
      department,
      shelves: department.children.map(toShelf),
      products: feeds[index].products,
    }))
    .filter((section) => section.products.length > 0);

  return (
    <main className="mx-auto w-full max-w-[var(--shell)] px-0 pb-24 pt-3 md:px-8 lg:pb-12">
      {/* The department index, declared as a list of departments.
          Every child is included, not only the top-level ones — the whole point
          of this page for a crawler is that it is the one place the full tree is
          reachable without opening a menu. See `itemListJsonLd`. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "All categories", path: "/categories" },
            ]),
            itemListJsonLd(
              "All categories",
              "/categories",
              departments.flatMap((department) => [
                { name: department.name, path: `/category/${department.slug}` },
                ...department.children.flatMap((child) => [
                  { name: child.name, path: `/category/${child.slug}` },
                  ...child.children.map((grandchild) => ({
                    name: grandchild.name,
                    path: `/category/${grandchild.slug}`,
                  })),
                ]),
              ])
            ),
          ]),
        }}
      />

      {/* The breadcrumb is desktop-only now. On a phone this page IS the
          navigation — a bottom-nav tab leads to it, and the browser below puts
          every department one tap away — so a row saying where the shopper is
          is a line of text spent telling them what they can already see. */}
      <nav className="phone-gutter mb-3 hidden items-center gap-2 text-[13px] text-shop-muted md:flex">
        <Link href="/" className="hover:text-shop-ink">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="text-shop-ink">All categories</span>
      </nav>

      {/* ---- The masthead is one line now ----

          It was a rounded gradient band about 250px tall: an eyebrow, a 38px
          title, a sentence of prose and two stat chips. On a phone that is the
          entire first screen spent on the page introducing itself, and this
          page has to introduce itself to nobody — a shopper who tapped
          "Categories" knows what they tapped.

          The h1 stays because the page needs one and it is what the tab and
          the search result are named after. The subtitle carries the counts
          the chips used to, in the one form that is worth saying out loud. */}
      {/* One line on a phone. The h1 has to exist — it names the tab and the
          search result — but the two-pane browser under it is self-explanatory
          in a way a stack of rails was not, so the sentence of counts that
          introduced them is desktop-only. */}
      <header className="phone-gutter mb-3 md:mb-5">
        <h1 className="heading-black text-[19px] leading-tight text-shop-ink md:text-[32px]">
          Browse the shop
        </h1>
        <p className="section-sub mt-1 hidden text-[14px] md:block">
          {departments.length > 0
            ? `${departments.length} ${departments.length === 1 ? "department" : "departments"}, shelf by shelf.`
            : "Categories are being set up. Everything on the shop is still one search away."}
        </p>
      </header>

      {sections.length === 0 ? (
        <div className="phone-gutter"><div className="rounded-3xl border border-shop-line bg-white p-10 text-center">
          <p className="text-[15px] text-shop-muted">
            Nothing to browse yet. Have a look at everything on the shop instead.
          </p>
          <Link href="/search" className="btn-shop mt-5 inline-flex px-7 py-2.5 text-[15px]">
            Browse all products
          </Link>
        </div></div>
      ) : (
        <>
          {/* The phone's version of everything below it. Rendered from the same
              tree, shown below `md`, and the rails are hidden there — the two
              are alternatives, not a layout that reflows. */}
          <CategoryBrowser departments={browse} grids={browseGrids} />

          {/* The jump row survives the redesign and matters more than it did.
              Each department is now a heading, a tab row and a rail rather
              than a card, so the page is taller than the one it replaced and
              the last department is further down it. */}
          {sections.length > 2 && (
            <nav
              aria-label="Jump to a department"
              /* The negative margin is gone with the page gutter it was
                 cancelling: this row has always been full-bleed on a phone, and
                 with the column at zero padding that is now simply what it is. */
              className="mb-4 hidden gap-2 overflow-x-auto px-3 pb-1 no-scrollbar md:flex md:flex-wrap md:px-0"
            >
              {sections.map(({ department }) => (
                <a
                  key={department.id}
                  href={`#dept-${department.slug}`}
                  className="shrink-0 rounded-full border border-shop-line bg-white px-4 py-2 text-[13px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary"
                >
                  {department.name}
                </a>
              ))}
            </nav>
          )}

          {/* 40px between departments and no rule between them. The rails
              already end in a hard edge — a row of photographs stops where it
              stops — and a divider under one is a second full-width line
              directly beneath a line of tiles. Space separates them, which is
              what the homepage does with the same objects. */}
          <div className="hidden flex-col gap-10 md:flex">
            {sections.map(({ department, shelves, products }, index) => (
              <CategoryShelves
                key={department.id}
                name={department.name}
                slug={department.slug}
                shelves={shelves}
                products={products}
                priority={index === 0}
              />
            ))}
          </div>
        </>
      )}


    </main>
  );
}


/**
 * A shelf and every slug beneath it, flattened for the client.
 *
 * The subtree is the part that matters: "Shoes" itself usually holds no
 * products at all — they are filed under "Sneakers" and "Boots" — so a tab
 * matching on the shelf slug alone would be empty on exactly the shops that
 * organise their catalogue well.
 */
function toShelf(node: CategoryNode): Shelf {
  return { name: node.name, slug: node.slug, slugs: subtreeSlugs(node) };
}

function subtreeSlugs(node: CategoryNode): string[] {
  return [node.slug, ...node.children.flatMap(subtreeSlugs)];
}
