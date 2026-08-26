import Link from "next/link";
import Image from "next/image";
import type { ProductCategory } from "@/lib/woocommerce";

/**
 * The round department shortcuts that open the shop.
 *
 * ---- What this is for ----
 *
 * The row that used to sit here was {@link CategoryChips}: outlined pills, one
 * line of text each, under a "Explore your interests" heading. Chips are the
 * right shape for a FILTER — a state you are toggling on a list you can already
 * see — and the wrong one for the top of a homepage, where nothing has been
 * listed yet and the row is the shop's front door.
 *
 * Every marketplace this shop is measured against draws that door as a row of
 * circles, and the reason is not fashion. A circle is a target the eye finds
 * without reading: the row can be scanned in one sweep and a department picked
 * before a single word has been processed. A row of identical outlined pills
 * has to be READ, left to right, and on a phone that is fourteen words between
 * the shopper and the products.
 *
 * ---- The photograph, and what happens without one ----
 *
 * WooCommerce category images are optional and most of this catalogue has none.
 * That is the case this component is built around rather than the exception it
 * handles: a circle with a broken image in it is worse than no circle, and a
 * circle carrying the category's first letter reads as a missing avatar.
 *
 * So the fallback is not a picture at all. It is the department's initials on
 * the brand's soft tint — a deliberate flat token, the same one the shop uses
 * behind an active row — which reads as a designed label rather than as a
 * photograph that failed. The row stays uniform either way, which is the part
 * that matters: one tile in fourteen looking different is what makes a strip
 * look broken.
 *
 * ---- Why it is not a client component ----
 *
 * It scrolls, and scrolling is the browser's job. There is no state here, no
 * arrows and no snap: a shortcut row is short enough that a swipe reaches the
 * end of it, and every control added to it is a control competing with the
 * products underneath. `DealCarousel` earns its arrows because its track is
 * forty products long; this one is fourteen circles.
 */

/** How many shortcuts the row carries before it stops. */
const SHOWN = 14;

/**
 * One or two initials for a department with no photograph.
 *
 * Two words give two letters ("Home & Living" is HL, the ampersand skipped
 * because it is not a word); one word gives one. Three or more letters in a
 * 64px circle stops being a mark and becomes small text.
 */
function initials(name: string): string {
  const words = name
    .split(/[\s&/]+/)
    .map((word) => word.trim())
    .filter((word) => /^[a-z]/i.test(word));

  if (words.length === 0) return name.slice(0, 1).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function CategoryCircles({ categories }: { categories: ProductCategory[] }) {
  // Stocked departments first — a shortcut leading to an empty page is worse
  // than one fewer shortcut.
  const shown = [...categories]
    .filter((category) => (category.count ?? 0) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name))
    .slice(0, SHOWN);

  // Below three the row reads as an accident rather than a navigation strip.
  if (shown.length < 3) return null;

  return (
    <nav aria-label="Shop by department">
      {/* No heading. "Explore your interests" sat above the old chips and said
          nothing a row of department names does not already say — a label
          explaining a list of labels. The circles are self-describing, and the
          line it occupied is a line of products further up the page.

          `items-start` so a two-line caption under one circle does not drag the
          whole row's baseline down with it. */}
      <ul className="flex items-start gap-x-5 gap-y-4 overflow-x-auto pb-1 no-scrollbar sm:gap-x-7">
        {shown.map((category) => (
          <li key={category.id} className="w-[68px] shrink-0 sm:w-[76px]">
            <Link
              href={`/category/${category.slug}`}
              className="group flex flex-col items-center gap-2 text-center"
            >
              <span className="relative block h-[64px] w-[64px] overflow-hidden rounded-full bg-shop-primary-soft ring-1 ring-shop-line transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:ring-shop-primary sm:h-[72px] sm:w-[72px]">
                {category.image ? (
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    // The circle never renders larger than 72px, so the browser
                    // is told exactly that. A `sizes` left unset on a `fill`
                    // image makes it fetch as though the tile were the full
                    // viewport, which on this row is fourteen full-width
                    // downloads for fourteen thumbnails.
                    sizes="72px"
                    className="object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-full w-full items-center justify-center text-[19px] font-bold tracking-[-0.02em] text-shop-primary-ink"
                  >
                    {initials(category.name)}
                  </span>
                )}
              </span>

              {/* Two lines, then clipped. A department called "Electronics &
                  Accessories" is not going to fit 68px on one line, and
                  truncating it to "Electron…" identifies nothing — where two
                  lines of 11px carry almost every name this catalogue has. */}
              <span className="line-clamp-2 text-[11.5px] leading-[14px] text-shop-body transition-colors group-hover:text-shop-primary">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
