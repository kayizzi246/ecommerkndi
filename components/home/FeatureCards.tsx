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
  /**
   * The card's colour, as a `feature-accent-*` class from globals.css.
   *
   * ---- Four strong colours, on purpose this time ----
   *
   * These cards carried four pastels once and the note below records why they
   * were taken away: four unrelated washes behind four sets of product
   * photography is the arrangement that makes a page look generated, and the
   * tints were competing with the merchandise for the same attention.
   *
   * What comes back is not that. The colour is saturated rather than washed,
   * and it is spent only on the parts of the card that are NOT merchandise —
   * the rule across the top, the badge, and the title on hover. The ground
   * under the photographs stays white, so nothing is tinted and the pastels'
   * actual failure does not recur. Four strong marks read as four named
   * shelves; four pale grounds read as a colour scheme nobody chose.
   */
  accent: string;
  href: string;
  products: Product[];
};

export default function FeatureCards({ cards }: { cards: FeatureCard[] }) {
  const filled = cards.filter((card) => card.products.length >= 2);

  if (filled.length === 0) return null;

  return (
    <section aria-label="Ways to shop">
      {/* ---- One sheet, not four cards with air between them ----

          The gap is gone at every width. Four rounded cards with 12px between
          them are four objects a shopper has to take in one at a time; four
          panels sharing hairline seams are one block that says "here are the
          four ways to shop", which is the sentence this row exists to say. It
          is the same move the product grid made when its gutters went — see
          `.product-grid-flush` — and for the same reason: the space between
          two cards was not separating anything the edge was not already
          separating.

          `feature-sheet` (globals.css) draws those seams and squares the inner
          corners. It owns the gap, so there is no `gap-*` utility here: the
          class is unlayered and would win silently over one.

          Two across on a phone rather than one. A single column of these is a
          LIST of programmes, and a list reads as terms rather than as an
          invitation — the same argument the savings band was held to before it
          was folded into the band above. Four across from lg, which is where this
          row and the portal band above it settle onto the same four columns. */}
      <ul className="feature-sheet grid grid-cols-2 lg:grid-cols-4">
        {filled.map((card) => (
          <li key={card.title}>
            <div
              /* ---- White ground, coloured marks ----

                 The ground is still white and that is not negotiable: the
                 photography is the colour on this page, and the pastel washes
                 these cards used to carry were competing with the one thing a
                 shopper is trying to look at.

                 The colour is in the rule across the top, the badge and the
                 hover — see the `accent` note on the type. Ten product shots
                 sit inside these four cards and not one of them stands on a
                 tint.

                 No `rounded-2xl` and no `ring` any more: the cards are cells in
                 one sheet now and `feature-sheet` draws the seams between them.
                 The hover lift goes with them for the reason the flush product
                 grid gave up its own — a cell that rises 2px opens a hole in the
                 sheet and drags its neighbours' seams out of true. */
              className={`group flex h-full flex-col bg-white p-3.5 ${card.accent}`}
            >
              {/* The one place the colour is a block rather than a mark. 3px,
                  full width of the card, directly above the title it belongs
                  to — enough to name the shelf at a glance from across the row
                  and small enough that four of them read as a row of labels
                  rather than as four coloured cards. */}
              <span
                aria-hidden
                className="-mx-3.5 -mt-3.5 mb-3 block h-[3px] bg-[var(--accent)]"
              />

              <div className="flex items-start justify-between gap-2">
                {/* `after:absolute inset-0` would be the usual trick for making
                    the whole card clickable from one link. It is deliberately not
                    used: the overlay would sit on top of the two product links
                    below and swallow their clicks, which is the same bug as the
                    nested anchor with none of the invalid markup to give it
                    away. */}
                <Link
                  href={card.href}
                  className="text-[14px] font-extrabold leading-tight text-shop-ink transition-colors hover:text-[color:var(--accent)] group-hover:text-[color:var(--accent)]"
                >
                  {card.title}
                </Link>
                {/* Solid accent, white type. The badge was a grey chip on three
                    of the four cards, which made it a label for the card rather
                    than a mark for the shelf; filled, it is the thing that tells
                    you which shelf you are looking at from the far side of the
                    row. Every accent below clears AA for white at this size. */}
                <span className="shrink-0 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-white">
                  {card.badge}
                </span>
              </div>

              <p className="mt-0.5 line-clamp-1 text-[11.5px] text-shop-muted">
                {card.note}
              </p>

              {/* ---- One on a phone, two from `sm` up ----

                  Two 40vw thumbnails side by side inside a half-width card is a
                  ~70px photograph, which is smaller than the price printed
                  under it — the evidence the card exists to show, shown too
                  small to be evidence. One product per card on a phone gets
                  that back to something a shopper can actually see.

                  The second product is not dropped from the data, only from the
                  render: `pick` still reserves two per card so a card is never
                  drawn on a shelf that only had one product in it, and the
                  wider layouts still show both. */}
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {card.products.slice(0, 2).map((product, index) => (
                  <li
                    key={product.id}
                    className={index === 1 ? "hidden sm:block" : undefined}
                  >
                    <MiniProduct
                      product={product}
                      sizes="(max-width: 640px) 46vw, (max-width: 1024px) 22vw, 150px"
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
