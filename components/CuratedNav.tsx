import Link from "next/link";
import type { CategoryNode } from "@/lib/woocommerce";
import { findCategorySlug } from "@/lib/departments";

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

// The matcher moved to lib/departments.ts: the homepage fills its Men, Women
// and Kids rails from the same words, and a rail that resolved a department
// differently from the link above it would send shoppers somewhere other than
// the products they had just been shown.

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
        const slug = entry.match ? findCategorySlug(departments, entry.match) : null;
        const href =
          entry.href ??
          (slug ? `/category/${slug}` : `/search?q=${encodeURIComponent(entry.match ?? "")}`);

        return (
          <Link
            key={entry.label}
            href={href}
            /* Bold, in ink rather than slate.

               These were 500 in `--color-shop-body`, which put the shop's whole
               department nav a shade lighter and a weight lighter than the
               product titles underneath it — so the eye landed on the grid
               first and the way to navigate it second. At 700 in near-black the
               row reads as the primary navigation it is.

               The deal link keeps its red: it is the one entry here that is a
               claim about price rather than a place, and it is already bold. */
            className={`relative shrink-0 whitespace-nowrap px-3 py-3 text-[14.5px] font-bold transition-colors ${
              entry.hot ? "text-shop-sale" : "text-shop-ink hover:text-shop-flame"
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
