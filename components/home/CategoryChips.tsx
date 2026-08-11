import Link from "next/link";
import type { ProductCategory } from "@/lib/woocommerce";

/**
 * A single scrolling row of department chips.
 *
 * Replaces the card grid that used to sit here. On a fashion storefront the
 * departments are a filter, not a destination — a chip states the name in one
 * line and costs a fraction of the height a picture card does, which keeps the
 * products the first thing on the page.
 *
 * Scrolls horizontally at every width rather than wrapping, so the row is
 * always exactly one line tall.
 */
export default function CategoryChips({ categories }: { categories: ProductCategory[] }) {
  // Stocked departments first — a chip leading to an empty page is worse than
  // one fewer chip.
  const shown = [...categories]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 14);

  if (shown.length < 3) return null;

  return (
    <nav aria-label="Shop by department">
      <ul className="flex gap-2 overflow-x-auto px-3 pb-1 no-scrollbar md:px-0">
        <li className="shrink-0">
          <Link
            href="/search"
            className="block rounded-full bg-shop-ink px-4 py-2 text-[13.5px] text-white transition-opacity hover:opacity-90"
          >
            All
          </Link>
        </li>
        {shown.map((category) => (
          <li key={category.id} className="shrink-0">
            <Link
              href={`/category/${category.slug}`}
              className="block whitespace-nowrap rounded-full border border-shop-line px-4 py-2 text-[13.5px] text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
