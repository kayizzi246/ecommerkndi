import Image from "next/image";
import Link from "next/link";
import type { CategoryRail } from "@/lib/home-feed";

/**
 * The departments as one swipeable row of round photos, the way the large
 * marketplaces open: a shopper sees every department at a glance and is one
 * tap from any of them. Each photo is a product that is in stock in that
 * department, so the row never advertises an empty shelf. Deals lead the row.
 */
export default function CategoryCircles({ categories }: { categories: CategoryRail[] }) {
  const picks = categories
    .map((category) => ({
      slug: category.slug,
      title: category.title,
      photo: category.products.find((product) => product.stock_status !== "outofstock" && product.image)?.image,
    }))
    .filter((category) => category.photo);

  if (picks.length === 0) return null;

  return (
    <nav className="hx-circles" aria-label="Shop by category">
      <ul className="hx-circles-row no-scrollbar">
        <li>
          <Link href="/sale" className="hx-circle">
            <span className="hx-circle-photo hx-circle-deals" aria-hidden>
              %
            </span>
            <span className="hx-circle-name">Deals</span>
          </Link>
        </li>
        {picks.map((category) => (
          <li key={category.slug}>
            <Link href={`/category/${category.slug}`} className="hx-circle">
              <span className="hx-circle-photo">
                <Image src={category.photo!} alt="" fill sizes="88px" className="object-cover" />
              </span>
              <span className="hx-circle-name">{category.title}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/categories" className="hx-circle">
            <span className="hx-circle-photo hx-circle-all" aria-hidden>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
              </svg>
            </span>
            <span className="hx-circle-name">All categories</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
