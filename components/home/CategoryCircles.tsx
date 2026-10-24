import Image from "next/image";
import Link from "next/link";

export type CategoryCircle = {
  slug: string;
  name: string;
  image: string | null;
};

/**
 * A row of round category photos, Temu's way into the departments.
 *
 * Built in the page from the department tree, each circle showing the
 * category's own image or, when wp-admin has none, a product filed under it —
 * so a department is a picture of what is in it rather than a word.
 */
export default function CategoryCircles({ categories }: { categories: CategoryCircle[] }) {
  if (categories.length === 0) return null;
  return (
    <nav className="hx-panel" aria-labelledby="hx-cats-title">
      <div className="hx-panel-head">
        <h2 id="hx-cats-title" className="hx-panel-title">
          Shop by category
        </h2>
        <Link href="/categories" className="hx-see-all">
          See all ›
        </Link>
      </div>
      <ul className="hx-cats no-scrollbar">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link href={`/category/${category.slug}`} className="hx-cat">
              <span className="hx-cat-photo">
                {category.image ? (
                  <Image src={category.image} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <span className="hx-cat-initial" aria-hidden>
                    {category.name.charAt(0)}
                  </span>
                )}
              </span>
              <span className="hx-cat-name">{category.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
