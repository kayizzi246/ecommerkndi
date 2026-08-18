import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCategories, buildCategoryTree } from "@/lib/woocommerce";
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
 */
export default async function CategoriesPage() {
  const categories = await getCategories();
  const departments = buildCategoryTree(categories);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-0 pb-24 pt-4 md:px-8 lg:pb-12">
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
                ...department.children.map((child) => ({
                  name: child.name,
                  path: `/category/${child.slug}`,
                })),
              ])
            ),
          ]),
        }}
      />

      <nav className="mb-4 flex items-center gap-2 px-3 text-[13px] text-shop-muted md:px-0">
        <Link href="/" className="hover:text-shop-ink">
          Home
        </Link>
        <span aria-hidden>›</span>
        <span className="text-shop-ink">All categories</span>
      </nav>

      <header className="mb-5 px-3 md:px-0">
        <h1 className="heading-black text-[24px] text-shop-ink md:text-[28px]">All categories</h1>
        <p className="section-sub mt-1 text-[14.5px]">
          {departments.length > 0
            ? `${departments.length} ${departments.length === 1 ? "department" : "departments"} to browse`
            : "Categories are being set up."}
        </p>
      </header>

      {departments.length === 0 ? (
        <div className="mx-3 rounded-2xl border border-shop-line bg-white p-8 text-center md:mx-0">
          <p className="text-[15px] text-shop-muted">
            No categories yet. Have a look at everything on the shop instead.
          </p>
          <Link href="/search" className="btn-shop mt-5 inline-flex px-7 py-2.5 text-[15px]">
            Browse all products
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-px">
          {departments.map((department) => (
            <li key={department.id} className="bg-white px-3 py-4 md:rounded-2xl md:border md:border-shop-line md:px-5">
              <div className="flex items-center gap-3">
                {department.image ? (
                  <Image
                    src={department.image}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-shop-primary-soft text-[18px] font-bold text-shop-primary"
                  >
                    {department.name.charAt(0).toUpperCase()}
                  </span>
                )}

                <Link
                  href={`/category/${department.slug}`}
                  className="min-w-0 flex-1 text-[16px] font-bold text-shop-ink hover:text-shop-primary"
                >
                  {department.name}
                  {typeof department.count === "number" && department.count > 0 && (
                    <span className="ml-2 text-[13px] font-medium text-shop-muted">
                      {department.count}
                    </span>
                  )}
                </Link>
              </div>

              {/* Children as chips rather than a nested list: a shopper looking
                  for "Men's shoes" should reach it in one tap from here, not
                  land on "Shoes" and hunt again. */}
              {department.children.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2 pl-15">
                  {department.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/category/${child.slug}`}
                        className="inline-flex rounded-full border border-shop-line px-3 py-1.5 text-[13.5px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
