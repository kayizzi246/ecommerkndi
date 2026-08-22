import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCategories, buildCategoryTree, type CategoryNode } from "@/lib/woocommerce";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "All categories",
  description:
    "Every department on KandiUg — browse clothing, shoes, electronics, home and more from Ugandan sellers.",
  alternates: { canonical: "/categories" },
};

/**
 * Every department on the shop, as a page rather than a hover menu.
 *
 * This exists because the Categories tab in the mobile bar pointed at
 * `/#categories`, an anchor that was not on the homepage and had probably never
 * been — so a quarter of the bottom navigation did nothing at all when tapped.
 * A dead tab in the primary navigation is worse than a missing one: a shopper
 * assumes the site is broken rather than that the feature is elsewhere.
 *
 * The desktop mega-menu opens on hover, which a phone has no way to do. This is
 * the same tree, laid out for a thumb.
 *
 * ---- The layout, and why it changed ----
 *
 * It used to be one full-width row per department with the children as a wrap of
 * outline chips. With four departments that is four near-empty bands stacked
 * down a 1500px page: the eye reads four words and a lot of white, and nothing
 * on the screen says which department is the big one. The chips also carried no
 * information beyond the name — the same word already in the menu.
 *
 * Now: a two-up card grid, each department a card with its children as a
 * two-column index inside it, every row carrying its product count and its own
 * children's names underneath. The tree already goes three deep (see
 * `buildCategoryTree`, which was fixed to keep grandchildren) and this page was
 * throwing that third level away. Showing it is the difference between a page
 * that repeats the nav and one worth landing on from search.
 */
export default async function CategoriesPage() {
  const categories = await getCategories();
  const departments = buildCategoryTree(categories);
  const totalProducts = departments.reduce((sum, department) => sum + countOf(department), 0);

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

      {/* The masthead of the page: one warm band, so the index below it reads as
          content rather than as more chrome. The tint is the only orange fill on
          the screen — everything else stays white, per the palette note at the
          top of `globals.css`. */}
      <header className="overflow-hidden rounded-3xl border border-shop-line bg-gradient-to-br from-shop-primary-soft via-white to-white px-5 py-7 md:px-8 md:py-9">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-shop-primary-ink">
          Browse the shop
        </p>
        <h1 className="heading-black mt-2 text-[28px] leading-tight text-shop-ink md:text-[38px]">
          All categories
        </h1>
        <p className="section-sub mt-2 max-w-xl text-[14.5px] md:text-[15.5px]">
          {departments.length > 0
            ? "Every department on KandiUg, with everything filed under it — pick a shelf and go straight there."
            : "Categories are being set up. Everything on the shop is still one search away."}
        </p>

        {departments.length > 0 && (
          <dl className="mt-5 flex flex-wrap items-center gap-2">
            <Stat
              value={departments.length}
              label={departments.length === 1 ? "department" : "departments"}
            />
            {totalProducts > 0 && <Stat value={totalProducts} label="products" />}
          </dl>
        )}
      </header>

      {departments.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-shop-line bg-white p-10 text-center">
          <p className="text-[15px] text-shop-muted">
            No categories yet. Have a look at everything on the shop instead.
          </p>
          <Link href="/search" className="btn-shop mt-5 inline-flex px-7 py-2.5 text-[15px]">
            Browse all products
          </Link>
        </div>
      ) : (
        <>
          {/* A jump row, not decoration: on a phone this page is one tall card per
              department and the last one is well below the fold. */}
          {departments.length > 2 && (
            <nav
              aria-label="Jump to a department"
              className="-mx-3 mt-4 flex gap-2 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:px-0"
            >
              {departments.map((department) => (
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

          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {departments.map((department) => (
              <li key={department.id}>
                <DepartmentCard department={department} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full border border-shop-line bg-white px-3.5 py-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="text-[15px] font-extrabold text-shop-ink">{value.toLocaleString()}</dd>
      <span className="text-[13px] font-medium text-shop-muted">{label}</span>
    </div>
  );
}

/**
 * One department: a header that is itself the link into it, and its children as
 * an index underneath.
 *
 * `h-full` on the card so two cards in a row match height even when one
 * department has seven children and its neighbour has two — a ragged bottom edge
 * is the thing that makes a two-up card grid look unfinished.
 */
function DepartmentCard({ department }: { department: CategoryNode }) {
  const count = countOf(department);

  return (
    <section
      id={`dept-${department.slug}`}
      className="flex h-full scroll-mt-24 flex-col overflow-hidden rounded-3xl border border-shop-line bg-white transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(17,24,39,0.35)]"
    >
      <div className="flex items-center gap-3.5 border-b border-shop-line px-4 py-4 md:px-5">
        {department.image ? (
          <Image
            src={department.image}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-shop-primary-soft text-[20px] font-black text-shop-primary-ink"
          >
            {department.name.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-extrabold text-shop-ink md:text-[18px]">
            <Link href={`/category/${department.slug}`} className="hover:text-shop-primary">
              {department.name}
            </Link>
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-shop-muted">
            {count > 0
              ? `${count.toLocaleString()} ${count === 1 ? "product" : "products"}`
              : "Coming soon"}
            {department.children.length > 0 &&
              ` · ${department.children.length} ${department.children.length === 1 ? "shelf" : "shelves"}`}
          </p>
        </div>

        <Link
          href={`/category/${department.slug}`}
          className="shrink-0 rounded-full border border-shop-line px-3.5 py-2 text-[13px] font-bold text-shop-ink transition-colors hover:border-shop-primary hover:text-shop-primary"
        >
          Shop all <span aria-hidden>→</span>
        </Link>
      </div>

      {/* Children as an index rather than chips: a shopper looking for "Men's
          shoes" should reach it in one tap from here, not land on "Shoes" and
          hunt again — and the grandchildren under each row say what is on that
          shelf before anyone spends a tap finding out. */}
      {department.children.length > 0 && (
        <ul className="grid flex-1 content-start gap-0.5 p-2 sm:grid-cols-2 md:p-3">
          {department.children.map((child) => (
            <li key={child.id}>
              <Link
                href={`/category/${child.slug}`}
                className="group/row block rounded-2xl px-3 py-2.5 transition-colors hover:bg-shop-primary-soft"
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-shop-body group-hover/row:text-shop-primary-ink">
                    {child.name}
                  </span>
                  {typeof child.count === "number" && child.count > 0 && (
                    <span className="shrink-0 text-[12.5px] tabular-nums text-shop-muted">
                      {child.count}
                    </span>
                  )}
                </span>
                {child.children.length > 0 && (
                  <span className="mt-0.5 block truncate text-[12.5px] text-shop-muted">
                    {child.children.map((grandchild) => grandchild.name).join(" · ")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * A department's own `count` is the products filed directly on the term, which
 * for a parent is often 0 — everything really hangs off its children. Summing
 * the subtree is what a shopper means by "how much is in here".
 */
function countOf(node: CategoryNode): number {
  return (node.count ?? 0) + node.children.reduce((sum, child) => sum + countOf(child), 0);
}
