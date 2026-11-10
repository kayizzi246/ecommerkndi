import Image from "next/image";
import Link from "next/link";
import type { CategoryRail } from "@/lib/home-feed";

/** Real catalog photography keeps each visual invitation tied to available stock. */
export default function CategorySpotlights({ categories }: { categories: CategoryRail[] }) {
  const picks = categories.map((category) => ({
    ...category,
    photos: category.products.filter((product) => product.stock_status === "instock" && product.image).slice(0, 2),
  })).filter((category) => category.photos.length > 0).slice(0, 4);

  if (picks.length === 0) return null;

  return (
    <section className="hx-panel hx-discover" aria-labelledby="discover-title">
      <div className="hx-panel-head">
        <h2 id="discover-title" className="hx-panel-title">Shop by category</h2>
        <Link href="/categories" className="hx-see-all">View all categories &rarr;</Link>
      </div>
      <div className="hx-discover-grid">
        {picks.map((category) => (
          <Link key={category.slug} href={`/category/${category.slug}`} className="hx-discover-card">
            <div className="hx-discover-photos">
              {category.photos.map((product) => (
                <div key={product.id} className="hx-discover-photo">
                  <Image src={product.image} alt={product.name} fill sizes="(max-width: 639px) 22vw, (max-width: 1023px) 20vw, 200px" className="object-contain" />
                </div>
              ))}
            </div>
            <div className="hx-discover-label">
              <h3>{category.title}</h3>
              <span>Shop collection &rarr;</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
