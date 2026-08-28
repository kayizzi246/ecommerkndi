import Link from "next/link";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * The savings shelf — a cream band of offers, under the first product rail.
 *
 * ---- What it is ----
 *
 * Four promotional cards on a tinted ground: a badge, a headline, a line of
 * qualifying detail, and a link. Not products — OFFERS, which is a different
 * thing and the reason this is not another `DealCarousel`. A rail of tiles says
 * "here are things to buy"; this says "here is how to pay less for them", and
 * a shopper reads those two in different modes.
 *
 * ---- Where the content comes from ----
 *
 * `settings.promotions`, which has carried exactly this shape for a long time —
 * `{ badge, headline, note, url }` — and had no consumer anywhere in the shop.
 * It was declared, parsed, defaulted to an empty array, and read by nothing.
 * So this section is not a new field to fill in; it is the screen that finally
 * renders one that already existed.
 *
 * Empty is the shipped state and the section renders nothing for it. That is
 * deliberate and it matters more here than in most places: a "Maximise your
 * savings" band with two placeholder offers in it is worse than no band, and a
 * default would put one on every shop that never opened the settings screen.
 *
 * ---- The ground ----
 *
 * White, with a hairline above and below. It was a warm cream for a while, on
 * the argument that a tinted band separates a section without a heading having
 * to. That is true and it stopped being the shop's answer: the page carried a
 * cream shelf, a yellow shelf and then an ink one within a few screens, and
 * every one of them fought the white product cards standing on it. The rule
 * this section follows now is the shop's: white everywhere, and structure drawn
 * rather than filled.
 *
 * A rule has no area, which is exactly why it works here — there is no field
 * for the photography or the type to argue with, and the section still reads as
 * one object.
 */
export default function MaximiseSavings({ settings }: { settings: SiteSettings }) {
  const offers = settings.promotions.filter((promotion) => promotion.headline);

  // Under three the row reads as a band that failed to fill rather than as a
  // shelf. Two offers belong in the copy of a section that has one.
  if (offers.length < 3) return null;

  return (
    <section
      aria-labelledby="savings-heading"
      /* Full-bleed by cancelling the column's own gutter, then padding it back
         — the same `-mx-` trick as the yellow shelf and the promise band. A
         tinted band that respects the gutter floats with a white sliver down
         each edge and reads as a card rather than as a shelf. */
      /* A panel, where this was a full-bleed band ruled top and bottom. The
         rules were how a tinted strip announced its own edges on a flat white
         page; a panel draws its own, so they were describing a boundary that
         is now visible. */
      className="home-panel"
    >
      <h2
        id="savings-heading"
        className="heading-black mb-4 text-[17px] text-shop-ink md:text-[19px]"
      >
        Maximise your savings
      </h2>

      {/* Four across at the top, two on a phone. Never one: a single column of
          offer cards is a list, and a list of offers reads as terms and
          conditions rather than as an invitation. */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {offers.slice(0, 4).map((offer) => (
          <li key={offer.headline}>
            <Link
              href={offer.url}
              className="group flex h-full flex-col rounded-xl bg-white/70 p-4 ring-1 ring-shop-ink/[0.06] transition-colors hover:bg-white"
            >
              {/* The badge is the code or the hook — "SAVE20", "FREE KIT". It
                  is set on ink rather than on the brand orange because the
                  whole band is already warm; an orange chip on cream is two
                  neighbouring hues arguing, and the ink chip is what the
                  reference uses for the same reason. */}
              {offer.badge && (
                <span className="mb-2.5 inline-flex w-fit items-center rounded-md bg-shop-ink px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white">
                  {offer.badge}
                </span>
              )}

              <p className="text-[14.5px] font-bold leading-snug tracking-[-0.01em] text-shop-ink transition-colors group-hover:text-shop-primary">
                {offer.headline}
              </p>

              {/* The qualifying line, and it is the honest half of an offer.
                  "Extra 20% off" is the hook; "on educational toys, over UGX
                  50,000" is what it actually means, and a promo card that
                  prints only the first is the kind a shopper stops trusting
                  after the second time. */}
              {offer.note && (
                <p className="mt-1 text-[12.5px] leading-snug text-shop-muted">{offer.note}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
