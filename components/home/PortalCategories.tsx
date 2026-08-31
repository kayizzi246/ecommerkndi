import Link from "next/link";
import type { CategoryNode } from "@/lib/woocommerce";

/**
 * The department column that opens the portal band, and the flyout behind it.
 *
 * ---- Why a list of words and not a grid of pictures ----
 *
 * Every previous attempt at putting the catalogue's structure on this page was a
 * grid of tiles, and every one of them died on the same fact: this catalogue
 * cannot supply a photograph for each department, so half the tiles rendered as
 * a letter on a tint. A list of words has no such dependency. It is also what
 * the reference does, and what every large marketplace does, for a reason worth
 * stating — a shopper who came for a department is reading, not browsing, and
 * eleven words in a column are read in about a second where eleven pictures are
 * not.
 *
 * ---- The flyout is CSS, not JavaScript ----
 *
 * `group-hover` on the row opens the panel. That keeps this a server component
 * with no hydration cost, and it keeps the whole column working before — and
 * without — JavaScript. The trade is that it is hover-only, which is why the
 * column is hidden below `md`: a flyout is a pointer idiom, and on a phone the
 * same tree is one tap away in the masthead's menu.
 *
 * The row itself is a LINK to the category, so the flyout is an accelerator
 * rather than the only way in. A hover panel that is the sole route to a
 * category is a category a keyboard cannot reach.
 */

/** One row of the column: a department, or a stocked section under one. */
type Row = {
  key: string;
  name: string;
  slug: string;
  /** The department this sits under. Absent on a department's own row. */
  under?: string;
  children: CategoryNode[];
};

/**
 * How many rows the column carries.
 *
 * This shop has four top-level departments, which drew a four-row column with
 * about 120px of white under it — a panel that reads as a list that failed to
 * finish loading. Ten is what fills the column beside the campaign panel without
 * the band growing to suit its own navigation.
 */
const ROWS = 10;

/**
 * The departments, then the deepest sections underneath them.
 *
 * ---- Why the extra rows are ranked by stock ----
 *
 * The shop asked for the fashion sections that move fastest, and this file has
 * no sales figures to rank by — WooCommerce reports a product count per
 * category, not a turnover. So the ranking is by CATALOGUE DEPTH, which is the
 * honest proxy available and is the same thing the department rails are held to
 * further down the page: a section the shop keeps deeply stocked is a section
 * the shop sells out of.
 *
 * The hard filter matters more than the ranking. This catalogue carries 64
 * categories and 55 of them have nothing in them at all — every hoodie
 * subdivision, most of the jewellery tree, three of the four Boots entries. A
 * column padded out with those is ten links to ten empty pages, which is worse
 * than the short column it replaced. `count > 0` is what stops that, and it is
 * why the row count is a ceiling rather than a target: a shop with nothing
 * beneath its departments correctly gets four rows again.
 */
function buildRows(departments: CategoryNode[]): Row[] {
  const rows: Row[] = departments.map((department) => ({
    key: `d${department.id}`,
    name: department.name,
    slug: department.slug,
    children: department.children,
  }));

  /* Every descendant at any depth, tagged with the department it belongs to.
     Depth matters here: this tree is three levels deep — Men → Shoes → Boots —
     and the middle level is where the stock actually is. */
  const stocked: { node: CategoryNode; under: string }[] = [];
  const walk = (nodes: CategoryNode[], under: string) => {
    for (const node of nodes) {
      if ((node.count ?? 0) > 0) stocked.push({ node, under });
      walk(node.children, under);
    }
  };
  for (const department of departments) walk(department.children, department.name);

  stocked.sort((a, b) => (b.node.count ?? 0) - (a.node.count ?? 0));

  for (const { node, under } of stocked) {
    if (rows.length >= ROWS) break;
    if (rows.some((row) => row.slug === node.slug)) continue;
    rows.push({
      key: `s${node.id}`,
      name: node.name,
      slug: node.slug,
      under,
      children: node.children,
    });
  }

  return rows.slice(0, ROWS);
}

export default function PortalCategories({
  departments,
}: {
  departments: CategoryNode[];
}) {
  const rows = buildRows(departments);

  if (rows.length === 0) return null;

  return (
    <nav
      aria-label="Departments"
      // `overflow-visible` is load-bearing: the flyout is an absolutely
      // positioned child that has to escape this box to the right, and a panel
      // that clipped it would render the whole hover interaction as a 2px sliver.
      className="hidden h-full flex-col overflow-visible rounded-2xl bg-white p-3 ring-1 ring-shop-line md:flex"
    >
      <p className="mb-1 px-2 text-[13px] font-bold text-shop-ink">
        All categories
      </p>

      <ul className="flex-1">
        {rows.map((row) => (
          <li key={row.key} className="group relative">
            <Link
              href={`/category/${row.slug}`}
              className="flex items-center gap-1.5 rounded-lg px-2 py-[5.5px] transition-colors group-hover:bg-shop-primary-soft"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] leading-tight">
                <span className="font-semibold text-shop-ink transition-colors group-hover:text-shop-primary">
                  {row.name}
                </span>
                {/* A department names two of its children — "Men / Shoes /
                    Hoodies" — the way the reference sets them. A section names
                    the department it lives in instead, and it has to: this
                    catalogue has three categories called "Shoes" and two called
                    "Boots", so a bare section name is a row a shopper cannot
                    place. */}
                {row.under ? (
                  <span className="text-shop-faint"> in {row.under}</span>
                ) : (
                  row.children.length > 0 && (
                    <span className="text-shop-faint">
                      {row.children
                        .slice(0, 2)
                        .map((child) => ` / ${child.name}`)
                        .join("")}
                    </span>
                  )
                )}
              </span>

              <svg
                className="h-3.5 w-3.5 shrink-0 text-shop-faint transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-shop-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="m9 5 7 7-7 7" />
              </svg>
            </Link>

            {/* ---- The flyout ----

                Anchored to the row rather than to the column, so it opens beside
                whatever the pointer is on. `-top-3` lifts it by the column's own
                padding so the first row's panel lines up with the top of the
                band rather than sitting 12px into it.

                It is only drawn for a row that actually has children. A panel
                that opens to say nothing is worse than no panel, because the
                shopper has to move the pointer to find that out. */}
            {row.children.length > 0 && (
              <div className="pointer-events-none invisible absolute -top-3 left-full z-30 w-[430px] pl-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                <div className="rounded-2xl bg-white p-4 shadow-[0_18px_44px_-16px_rgba(17,24,39,0.35)] ring-1 ring-shop-line">
                  <p className="mb-2.5 text-[13px] font-bold text-shop-ink">
                    {row.name}
                  </p>
                  <ul className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                    {row.children.slice(0, 18).map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/category/${child.slug}`}
                          className="block truncate text-[12.5px] text-shop-body transition-colors hover:text-shop-primary"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/category/${row.slug}`}
                    className="mt-3 inline-block text-[12.5px] font-semibold text-shop-primary hover:underline"
                  >
                    Everything in {row.name} →
                  </Link>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Link
        href="/categories"
        className="mt-1.5 block rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-shop-primary transition-colors hover:bg-shop-primary-soft"
      >
        All departments →
      </Link>
    </nav>
  );
}
