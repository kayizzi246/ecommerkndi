import type { Product } from "@/lib/woocommerce";
import DealCarousel from "@/components/DealCarousel";
import SectionHeader from "@/components/home/SectionHeader";

/**
 * One department's stock, as a rail — Men, Women, Kids.
 *
 * Built from the same {@link SectionHeader} and {@link DealCarousel} as every
 * other rail on the homepage, because the page's whole design argument is that
 * it has *one* heading style and one product tile. Three departments arriving
 * with three treatments of their own would undo that in a single commit, and a
 * shopper would read the page as three pages stacked.
 *
 * What distinguishes them is a single coloured chip beside the title. It is one
 * word, it carries no claim, and it is the only ornament: on a page that is
 * mostly photographs, the products supply the colour and a heading's job is to
 * be found, not admired.
 */
export default function DepartmentRail({
  id,
  title,
  subtitle,
  chip,
  tone,
  href,
  products,
  /** Below this many the rail reads as a mistake rather than a department. */
  minimum = 4,
}: {
  id: string;
  title: string;
  subtitle: string;
  /** The one-word label in the chip — "For him", "For her". */
  chip: string;
  /** Tailwind classes for the chip: a tint and its matching ink. */
  tone: string;
  href: string;
  products: Product[];
  minimum?: number;
}) {
  if (products.length < minimum) return null;

  return (
    <section aria-labelledby={id}>
      <SectionHeader id={id} title={title} subtitle={subtitle} href={href} linkLabel="Shop all">
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.08em] ${tone}`}
        >
          {chip}
        </span>
      </SectionHeader>

      <DealCarousel products={products} />
    </section>
  );
}
