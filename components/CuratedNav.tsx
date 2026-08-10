import Link from "next/link";
import type { CategoryNode } from "@/lib/woocommerce";

/**
 * The curated top-level nav.
 *
 * Hand-written rather than generated from the WooCommerce category tree. That
 * tree is whatever the catalogue happens to contain — on this shop it rendered
 * "Formal Shoes" and "Shoes" twice each — and a shop's main nav is a
 * merchandising decision, not a database listing. The full tree stays one click
 * away under "All Categories".
 *
 * `match` entries resolve to the real WooCommerce category of that name when one
 * exists. When it does not — a shop with no Kids department yet — the link falls
 * back to a search for the word, so the nav can never point at a dead category
 * page. Create the category in WordPress and the link upgrades itself.
 *
 * Lives in its own component because it renders in two places: full width in the
 * header on most pages, and inside the hero grid on the homepage, where it sits
 * beside the category sidebar.
 */
const NAV: { label: string; href?: string; match?: string; hot?: boolean }[] = [
  { label: "Super Deals", href: "/sale", hot: true },
  { label: "New Arrivals", href: "/search?sort=newest" },
  { label: "Best Sellers", href: "/search?sort=popular" },
  { label: "Men", match: "men" },
  { label: "Women", match: "women" },
  { label: "Kids", match: "kids" },
  { label: "Home & Living", match: "home" },
  { label: "Electronics", match: "electronics" },
  { label: "Beauty", match: "beauty" },
  { label: "Top Brands", href: "/sellers" },
];

/** Finds a department or sub-category by name/slug, at any depth. */
function findCategory(departments: CategoryNode[], needle: string): string | null {
  const wanted = needle.toLowerCase();

  for (const department of departments) {
    for (const candidate of [department, ...department.children]) {
      const name = candidate.name.toLowerCase();
      const slug = candidate.slug.toLowerCase();
      // "Men" must not match "Women", so names are compared whole; slugs may
      // carry a suffix ("mens-shoes"), which the prefix test allows.
      if (name === wanted || slug === wanted || slug.startsWith(`${wanted}-`)) {
        return candidate.slug;
      }
    }
  }

  return null;
}

export default function CuratedNav({
  departments,
  className = "",
}: {
  departments: CategoryNode[];
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar ${className}`}>
      {NAV.map((entry) => {
        const slug = entry.match ? findCategory(departments, entry.match) : null;
        const href =
          entry.href ??
          (slug ? `/category/${slug}` : `/search?q=${encodeURIComponent(entry.match ?? "")}`);

        return (
          <Link
            key={entry.label}
            href={href}
            className={`relative shrink-0 whitespace-nowrap px-3 py-3 text-[14.5px] transition-colors ${
              entry.hot
                ? "font-bold text-shop-sale"
                : "font-medium text-shop-body hover:text-shop-flame"
            }`}
          >
            {entry.label}
            {entry.hot && (
              <span className="absolute -right-1 -top-0.5 rounded-full rounded-bl-none bg-shop-sale px-1.5 py-px text-[9px] font-bold leading-tight text-white">
                HOT
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
