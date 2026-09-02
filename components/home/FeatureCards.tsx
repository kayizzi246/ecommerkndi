import Link from "next/link";
import MiniProduct from "@/components/home/MiniProduct";
import type { Product } from "@/lib/woocommerce";

/**
 * The four programme cards under the portal band.
 *
 * ---- What these are, and what they are not ----
 *
 * Each card is a SHELF the shop already merchandises — the discount pool, the
 * newest listings from independent sellers, what other people actually bought,
 * the promotions strip — reduced to a name, a claim and two real products with
 * their prices showing.
 *
 * Every one of them used to be a full carousel of its own, and four carousels is
 * four headings, four rows of twelve tiles and about four screens. What that
 * bought over this was the eleventh through twenty-fourth product in each shelf;
 * what it cost was that a shopper met the fourth shelf on screen six rather than
 * screen one. The card keeps the sentence — "these sell", "these are new, from
 * real Ugandan shops" — and moves the browsing to the shelf's own page, which is
 * a better place to browse than a rail with an arrow on it.
 *
 * ---- A card with nothing behind it is not drawn ----
 *
 * `products` is what the home feed had left after the panels above took theirs,
 * and it is genuinely empty on a shop with no sellers or no sale running. A card
 * that renders its heading over two grey squares is worse than a three-card row:
 * it is the shop advertising a programme it does not have.
 *
 * ---- Why the card is not one big link ----
 *
 * The obvious build wraps the whole card in an `<a>` so anywhere on it is
 * clickable. It cannot be done here: the two thumbnails are links to their own
 * products, and an anchor inside an anchor is invalid HTML that browsers repair
 * by closing the outer one early — which silently detaches half the card from
 * the link it looks like it belongs to. So the heading is the link to the shelf,
 * the thumbnails are links to the products, and the card is the box around them.
 */

export type FeatureCard = {
  title: string;
  /** The claim under the title. One line, and it has to be checkable. */
  note: string;
  /** The small chip beside the title — what makes the four scannable at speed. */
  badge: string;
  /** Tailwind classes for that chip. */
  badgeTone: string;
  /** The soft gradient the card fades from — a Tailwind `from-*` class. */
  href: string;
  products: Product[];
};

export default function FeatureCards({ cards }: { cards: FeatureCard[] }) {
  const filled = cards.filter((card) => card.products.length >= 2);

  if (filled.length === 0) return null;

  return (
    <section aria-label="Ways to shop">
      {/* Two across on a phone rather than one. A single column of these is a
          LIST of programmes, and a list reads as terms rather than as an
          invitation — the same argument the savings band was held to before it
          was folded into the band above. Four across from lg, which is where this
          row and the portal band above it settle onto the same four columns. */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {filled.map((card) => (
          <li key={card.title}>
            <div
              /* ---- White, not a tint ----

                 These four cards each had a different pastel washing down from
                 the top — peach, blue, green, violet. Four unrelated hues in a
                 row is the arrangement that makes a page look generated rather
                 than designed: no shop picks four colours because it has four
                 shelves, and the colours were carrying no meaning, because
                 "Best sellers" is not blue in any sense a shopper could name.

                 The photography is the colour on this page. Ten product shots
                 sit inside these four cards, and every tint behind them was
                 competing with the thing the shopper is trying to look at.

                 What separates the cards now is what always actually separated
                 them: a hairline, a heading, and the badge. */
              className="group flex h-full flex-col rounded-2xl bg-white p-3.5 ring-1 ring-shop-edge transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-20px_rgba(120,72,30,0.35)]"
            >
              <div className="flex items-start justify-between gap-2">
                {/* `after:absolute inset-0` would be the usual trick for making
                    the whole card clickable from one link. It is deliberately not
                    used: the overlay would sit on top of the two product links
                    below and swallow their clicks, which is the same bug as the
                    nested anchor with none of the invalid markup to give it
                    away. */}
                <Link
                  href={card.href}
                  className="text-[14px] font-bold leading-tight text-shop-ink transition-colors hover:text-shop-primary group-hover:text-shop-primary"
                >
                  {card.title}
                </Link>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] ${card.badgeTone}`}
                >
                  {card.badge}
                </span>
              </div>

              <p className="mt-0.5 line-clamp-1 text-[11.5px] text-shop-muted">
                {card.note}
              </p>

              {/* Two products, and they are the whole point of the card. A
                  programme panel with no stock in it is a button with a paragraph
                  on it; two photographs and two prices are the evidence that the
                  shelf behind the heading is real. */}
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {card.products.slice(0, 2).map((product) => (
                  <li key={product.id}>
                    <MiniProduct
                      product={product}
                      sizes="(max-width: 768px) 40vw, (max-width: 1024px) 22vw, 150px"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
