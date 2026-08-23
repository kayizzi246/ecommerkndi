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
 * ---- The link index at the foot, which is not decoration ----
 *
 * The tabs are buttons, and buttons are invisible to a crawler. This page is
 * the one place on the site where the full three-level tree is reachable
 * without hovering a menu, and that is most of why it ranks at all — so the
 * tree stays, moved to the bottom and set quietly, where it serves the crawler
 * and the shopper who genuinely wants the whole list without being the first
 * thing either of them has to read.
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

  const sections = departments
    .map((department, index) => ({
      department,
      shelves: department.children.map(toShelf),
      products: feeds[index].products,
    }))
    .filter((section) => section.products.length > 0);

  return (
    <main className="mx-auto w-full max-w-[var(--shell)] px-3 pb-24 pt-4 md:px-8 lg:pb-16">
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

      <nav className="mb-3 flex items-center gap-2 text-[13px] text-shop-muted">
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
      <header className="mb-5">
        <h1 className="heading-black text-[26px] leading-tight text-shop-ink md:text-[32px]">
          Browse the shop
        </h1>
        <p className="section-sub mt-1 text-[14px]">
          {departments.length > 0
            ? `${departments.length} ${departments.length === 1 ? "department" : "departments"}, shelf by shelf.`
            : "Categories are being set up. Everything on the shop is still one search away."}
        </p>
      </header>

      {sections.length === 0 ? (
        <div className="rounded-3xl border border-shop-line bg-white p-10 text-center">
          <p className="text-[15px] text-shop-muted">
            Nothing to browse yet. Have a look at everything on the shop instead.
          </p>
          <Link href="/search" className="btn-shop mt-5 inline-flex px-7 py-2.5 text-[15px]">
            Browse all products
          </Link>
        </div>
      ) : (
        <>
          {/* The jump row survives the redesign and matters more than it did.
              Each department is now a heading, a tab row and a rail rather
              than a card, so the page is taller than the one it replaced and
              the last department is further down it. */}
          {sections.length > 2 && (
            <nav
              aria-label="Jump to a department"
              className="-mx-3 mb-6 flex gap-2 overflow-x-auto px-3 pb-1 no-scrollbar md:mx-0 md:flex-wrap md:px-0"
            >
              {sections.map(({ department }) => (
                <a
                  key={department.id}
                  href={`#dept-${department.slug}`}
                  className="shrink-0 rounded-full border border-shop-line bg-white px-4 py-2 text-[13.5px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary"
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
          <div className="flex flex-col gap-10">
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

      {departments.length > 0 && <ShelfIndex departments={departments} />}
    </main>
  );
}

/**
 * The full tree as links, at the foot of the page.
 *
 * Set deliberately quiet — small type, no cards, no counts. It is not
 * competing with the rails above it; it is the fallback for the shopper who
 * wants the whole list, and the only way a crawler can see past the tab
 * buttons. Dropping it to make the page purely visual would have cost this
 * page the thing it is actually good at.
 *
 * Every level is a real `<a>`, including the grandchildren, which is the level
 * the old card grid rendered as plain text rather than as links.
 */
function ShelfIndex({ departments }: { departments: CategoryNode[] }) {
  return (
    <section aria-labelledby="shelf-index" className="mt-14 border-t border-shop-line pt-8">
      <h2 id="shelf-index" className="text-[15px] font-bold text-shop-ink">
        Every shelf
      </h2>
      <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {departments.map((department) => (
          <div key={department.id} className="min-w-0">
            <h3 className="text-[13.5px] font-bold uppercase tracking-[0.06em] text-shop-body">
              <Link href={`/category/${department.slug}`} className="hover:text-shop-primary">
                {department.name}
              </Link>
            </h3>
            <ul className="mt-2 space-y-2">
              {department.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/category/${child.slug}`}
                    className="text-[13.5px] font-semibold text-shop-ink hover:text-shop-primary"
                  >
                    {child.name}
                  </Link>
                  {child.children.length > 0 && (
                    <p className="mt-0.5 text-[12.5px] leading-5 text-shop-muted">
                      {child.children.map((grandchild, index) => (
                        <span key={grandchild.id}>
                          {index > 0 && <span aria-hidden> · </span>}
                          <Link
                            href={`/category/${grandchild.slug}`}
                            className="hover:text-shop-primary"
                          >
                            {grandchild.name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
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
