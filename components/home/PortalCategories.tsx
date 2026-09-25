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
  /** A shortcut row links here instead of to `/category/{slug}`. */
  href?: string;
  /** Faint text after a shortcut's name. */
  note?: string;
};

/**
 * Rows that always have products behind them, used to fill the column below
 * the stocked categories. The catalogue has only a handful of categories with
 * anything in them, and a four-row column under "All categories" read as a
 * shop with nothing to sell. Each of these is a listing of the whole catalogue
 * — deals, or a sort of everything — so none can open an empty page. They
 * fill only the space the real categories leave; as more categories are
 * stocked, they push these out.
 */
const SHORTCUTS: Row[] = [
  { key: "x-sale", name: "Super Deals", slug: "", href: "/sale", note: "Biggest price cuts", children: [] },
  { key: "x-new", name: "New in", slug: "", href: "/search?sort=newest", note: "Just added", children: [] },
  { key: "x-popular", name: "Best sellers", slug: "", href: "/search?sort=popular", note: "Most bought", children: [] },
  { key: "x-rated", name: "Top rated", slug: "", href: "/search?sort=rating", note: "Loved by shoppers", children: [] },
  { key: "x-cheap", name: "Lowest prices", slug: "", href: "/search?sort=price_asc", note: "Cheapest first", children: [] },
];

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
/**
 * The tree with every empty branch cut off.
 *
 * A department with nothing in it anywhere beneath it — Men and Kids, on the
 * live catalogue — was still listed first in this column, and its row, its
 * "/ Hoodies / Jewelry" subtitle and every link in its flyout opened an empty
 * page. A node survives only if it, or something under it, has a product.
 */
function stockedTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => {
    const children = stockedTree(node.children);
    return (node.count ?? 0) > 0 || children.length > 0 ? [{ ...node, children }] : [];
  });
}

function buildRows(allDepartments: CategoryNode[]): Row[] {
  const departments = stockedTree(allDepartments);
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

  // Super Deals leads the column in orange, the way the reference opens its
  // own with the running campaign; the other shortcuts fill what is left.
  const [sale, ...others] = SHORTCUTS;
  rows.unshift(sale);
  for (const shortcut of others) {
    if (rows.length >= ROWS) break;
    rows.push(shortcut);
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
      className="hidden h-full flex-col overflow-visible rounded-2xl bg-shop-surface p-3 md:flex"
    >
      <p className="mb-1 px-2 text-[12px] font-bold text-shop-ink">
        All categories
      </p>

      <ul className="flex-1">
        {rows.map((row) => (
          <li key={row.key} className="group relative">
            <Link
              href={row.href ?? `/category/${row.slug}`}
              className="flex items-center gap-1.5 rounded-lg px-2 py-[5.5px] transition-colors group-hover:bg-shop-primary-soft"
            >
              <RowIcon name={row.name} hot={row.key === "x-sale"} />
              <span className="min-w-0 flex-1 truncate text-[13px] leading-tight">
                <span
                  className={`font-semibold transition-colors group-hover:text-[#ff5000] ${
                    row.key === "x-sale" ? "text-[#ff5000]" : "text-shop-ink"
                  }`}
                >
                  {row.name}
                </span>
                {/* A department names two of its children — "Men / Shoes /
                    Hoodies" — the way the reference sets them. A section names
                    the department it lives in instead, and it has to: this
                    catalogue has three categories called "Shoes" and two called
                    "Boots", so a bare section name is a row a shopper cannot
                    place. */}
                {row.note ? (
                  <span className="text-shop-faint"> · {row.note}</span>
                ) : row.under ? (
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
                <div className="rounded-2xl bg-white p-4 ring-1 ring-shop-edge">
                  <p className="mb-2.5 text-[12px] font-bold text-shop-ink">
                    {row.name}
                  </p>
                  <ul className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                    {row.children.slice(0, 18).map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/category/${child.slug}`}
                          className="block truncate text-[12px] text-shop-body transition-colors hover:text-shop-primary"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/category/${row.slug}`}
                    className="mt-3 inline-block text-[12px] font-semibold text-shop-primary hover:underline"
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
        className="mt-1.5 block rounded-lg px-2 py-1.5 text-[12px] font-semibold text-shop-primary transition-colors hover:bg-shop-primary-soft"
      >
        All departments →
      </Link>
    </nav>
  );
}

/** Line icons for the column, chosen from the row name. */
const ICONS: { match: RegExp; d: string }[] = [
  { match: /deal|sale/i, d: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z" },
  { match: /new/i, d: "M12 5v14M5 12h14" },
  { match: /best|popular/i, d: "M5 20V10M12 20V4M19 20v-7" },
  { match: /rated|top/i, d: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" },
  { match: /low|cheap|price/i, d: "M3 12V4h8l10 10-8 8L3 12Zm5-4h.01" },
  { match: /home|decor|furniture/i, d: "M3 11 12 4l9 7v9H3v-9Zm6 9v-6h6v6" },
  { match: /candle|scent/i, d: "M12 3c1.5 2 2 3 2 4a2 2 0 1 1-4 0c0-1 .5-2 2-4ZM9 11h6v10H9z" },
  { match: /women|lad/i, d: "M9 3h6l-1 5 4 13H6l4-13-1-5Z" },
  { match: /men/i, d: "M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3h-2a2 2 0 0 1-4 0H8Z" },
  { match: /kid|baby|child/i, d: "M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-6 17a6 6 0 0 1 12 0" },
  { match: /shoe/i, d: "M3 16h18v3H3zM3 16l1-8 5 2 3 3 7 1 2 2" },
];
const FALLBACK = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z";

function RowIcon({ name, hot }: { name: string; hot: boolean }) {
  const d = ICONS.find((icon) => icon.match.test(name))?.d ?? FALLBACK;
  return (
    <svg
      aria-hidden
      className={`h-4 w-4 shrink-0 ${hot ? "text-[#ff5000]" : "text-shop-body"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d={d} />
    </svg>
  );
}
