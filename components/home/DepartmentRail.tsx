import Link from "next/link";
import type { Product } from "@/lib/woocommerce";
import DealCarousel from "@/components/DealCarousel";

/**
 * One department's stock, as a rail — Men, Women, Kids.
 *
 * These three are the only sections on the homepage that get a treatment of
 * their own, and the reason is that they answer a different question from
 * everything around them. Trending, Promotions, New arrivals and Best sellers
 * are all claims about *time* — what is hot, what is cheap, what just landed —
 * and they are correctly interchangeable, which is why they share one heading
 * and one tile. Men / Women / Kids answer "where do my things live", and a
 * shopper scanning for that is scanning for a landmark, not reading titles.
 *
 * So the landmark is drawn: a tinted band, a department glyph in a white disc,
 * and a Shop all pill. The tint is a gradient that has faded to white by the
 * time the products begin, so nothing here puts a colour cast behind a
 * photograph — the ornament stops where the merchandise starts.
 *
 * The tile itself is still {@link DealCarousel}, untouched. A department that
 * invented its own product card would undo the page's one real design argument
 * in a single commit.
 */

/**
 * The glyph in the disc, chosen by department id.
 *
 * Keyed off the id rather than passed in as a prop because the ids come from
 * `lib/home-feed.ts`, which is shared with the app — a `ReactNode` could not
 * cross that boundary, and a fourth department added there should render with
 * the neutral fallback rather than crash the page.
 */
function DepartmentGlyph({ id }: { id: string }) {
  const common = {
    className: "h-[22px] w-[22px]",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
  };

  if (id === "dept-men") {
    // A shirt: collar, shoulders, body.
    return (
      <svg {...common} aria-hidden>
        <path d="M9 3 12 6l3-3 4.5 2.2a1 1 0 0 1 .5 1.1L19.2 11H17v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9H4.8L4 6.3a1 1 0 0 1 .5-1.1Z" />
      </svg>
    );
  }

  if (id === "dept-women") {
    // A dress: bodice tapering to a flared hem.
    return (
      <svg {...common} aria-hidden>
        <path d="M9 3h6l-1.4 3.2 1 2.4L13 12l4.6 6.4A1 1 0 0 1 16.8 20H7.2a1 1 0 0 1-.8-1.6L11 12 9.4 8.6l1-2.4Z" />
      </svg>
    );
  }

  if (id === "dept-kids") {
    // A teddy: two ears over a round head.
    return (
      <svg {...common} aria-hidden>
        <circle cx="7" cy="6.5" r="2.6" />
        <circle cx="17" cy="6.5" r="2.6" />
        <circle cx="12" cy="14" r="6.5" />
        <path d="M10 13h.01M14 13h.01M10.5 16.5a2.4 2.4 0 0 0 3 0" />
      </svg>
    );
  }

  // Anything added to DEPARTMENTS later: a plain tag rather than nothing.
  return (
    <svg {...common} aria-hidden>
      <path d="M3.5 12.5 11 5h8v8l-7.5 7.5a1.5 1.5 0 0 1-2.1 0l-5.9-5.9a1.5 1.5 0 0 1 0-2.1ZM15.5 9h.01" />
    </svg>
  );
}

export default function DepartmentRail({
  id,
  title,
  subtitle,
  chip,
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
  href: string;
  products: Product[];
  minimum?: number;
}) {
  if (products.length < minimum) return null;

  return (
    // ---- The coloured band is gone ----
    //
    // Men, Women and Kids each sat on their own tinted gradient — blue, violet,
    // green — fading to white, with the glyph and the chip carrying the same
    // hue. Three washes of colour down one page, and every one of them was
    // behind a row of product photographs, which are the things on the page
    // that are actually supposed to carry colour.
    //
    // What the tint was buying was separation: a way of saying "this rail is a
    // different kind of thing from the one above it". A heading does that
    // better and costs nothing — these are the biggest titles on the page now,
    // and a title that can be found at a glance is the whole job the band was
    // hired for.
    <section aria-labelledby={id} className="pt-4 md:pt-5">
      {/* 12px, matching `SectionHeader` — this rail draws its own heading rather
          than using that component, so the homepage's spacing ratio has to be
          repeated here by hand or the tinted sections drift looser than the
          plain ones. See `app/page.tsx`. */}
      <div className="mb-3.5 flex items-center gap-3 px-3 md:px-5">
        {/* The glyph, in ink and with no disc under it. The white plate existed
            to lift it off the tint; against white it would be a circle drawn
            around nothing. It stays because it is the one thing that tells the
            three department rails apart at a glance while scrolling — but as a
            mark beside the title rather than a badge in its own right. */}
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center text-shop-ink sm:flex">
          <DepartmentGlyph id={id} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            {/* The largest heading on the homepage, and the same size as the
                curated rails' — see `SectionHeader`. Outfit at 700 with the
                tracking closed up, which is what a display face is for. */}
            <h2 id={id} className="heading-black text-[22px] text-shop-ink md:text-[26px]">
              {title}
            </h2>
            {/* The chip, in the neutral the rest of the page uses. It was the
                department's colour, and it was the last of the three things
                repeating that hue. */}
            <span className="rounded-full bg-shop-hairline px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-shop-body">
              {chip}
            </span>
          </div>
          <p className="section-sub mt-1 truncate text-[13px]">{subtitle}</p>
        </div>

        {/* A pill rather than the bare "View All ›" the other sections use.
            It is the only tappable thing in this header, and on a phone a
            target with an edge is one a thumb can find without aiming. */}
        <Link
          href={href}
          className="shrink-0 rounded-full bg-shop-ink px-3.5 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
        >
          Shop all
        </Link>
      </div>

      <DealCarousel products={products} />
    </section>
  );
}
