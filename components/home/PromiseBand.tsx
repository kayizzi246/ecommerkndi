import Link from "next/link";
import { formatPrice } from "@/lib/currency";

/**
 * A one-line reassurance band, directly under the masthead.
 *
 * ---- Why anything at all sits here, where the hero used to ----
 *
 * The hero banner that occupied this slot was removed, and the note in
 * `app/page.tsx` records why the slot is dangerous: four separate blocks of
 * navigation-dressed-as-content once stacked here and pushed the first real
 * product below the fold on every phone. Anything that goes back into it has to
 * justify its height against a row of merchandise.
 *
 * This earns roughly 36px. It is a single line, it makes no offer and it
 * carries no picture — it answers the three questions a first-time Ugandan
 * shopper has about a shop they have not bought from before, in the place they
 * are asked, which is before the first product rather than at the foot of the
 * page. {@link TrustBar} still closes the page and says the same things at
 * length; this is the short version, delivered early.
 *
 * ---- The colour, which is deliberately not a green bar ----
 *
 * The reference this was built against runs a saturated green strip across the
 * full width. That cannot happen here: the palette note at the head of
 * `globals.css` puts the shop at roughly 90% white, 5–8% orange, and reserves
 * green for delivery alone. A full-bleed green band would be a second brand
 * colour introduced at the top of the homepage, which is the exact failure that
 * note exists to prevent.
 *
 * So the structure is copied and the colour is not: `shop-successbg` is the
 * palest green in the palette, the tick is `shop-save` — the one green the shop
 * already spends, at 4.6:1 — and every word is near-black. It reads as a
 * reassurance strip without becoming a marketing band.
 *
 * ---- Every claim here is enforced somewhere ----
 *
 * Nothing on this band is a slogan. The delivery threshold is the figure
 * checkout actually applies, the returns window is the one in wp-admin, and
 * "pay on delivery" is a payment method the checkout really offers. A band of
 * this kind is worth nothing if one line on it is aspirational, because a
 * shopper who catches the soft one stops believing the other two.
 */
export default function PromiseBand({
  freeDeliveryFrom,
  returnsDays,
}: {
  /** The subtotal at which delivery stops being charged, from wp-admin. */
  freeDeliveryFrom: number;
  /** The returns window in days, from wp-admin. */
  returnsDays: number;
}) {
  const promises = [
    // A shop that has switched free delivery off gets the honest line rather
    // than "free delivery over UGX 0" — the same guard `TrustStrip` makes.
    freeDeliveryFrom > 0
      ? `Free delivery over ${formatPrice(freeDeliveryFrom)}`
      : "Delivery countrywide",
    "Pay on delivery",
    `${returnsDays}-day returns`,
  ];

  return (
    // ---- Not on a phone ----
    //
    // On a desktop this is one thin line in a page with room for it. On a phone
    // it was the FOURTH stacked band above the fold — free-delivery ticker,
    // masthead, department row, then this — and between them they pushed the
    // first product photograph most of the way off the opening screen. A
    // shopper who has to scroll before seeing a single thing for sale has been
    // shown four rows of the shop talking about itself.
    //
    // The promises are not lost: the same three run in the footer, the delivery
    // threshold is already in the ticker directly above this, and the returns
    // window is on every product page. This is the one of the four bands that
    // repeats content available elsewhere, so it is the one that goes.
    <section
      aria-label="Why shop with KandiUg"
      className="hidden border-y border-shop-successbg bg-shop-successbg md:block"
    >
      <div className="mx-auto flex max-w-[var(--shell)] items-center gap-x-5 gap-y-1 overflow-x-auto px-4 py-2 text-[12.5px] no-scrollbar md:px-8">
        {/* The lead-in, and the only bold thing on the band. It names the shop
            on purpose: "Why choose KandiUg" is a phrase somebody searching for
            this shop by name may well be typing, and until recently the string
            appeared almost nowhere in the page's visible copy — see the title
            note in `app/page.tsx`. */}
        <span className="shrink-0 font-semibold text-shop-ink">Why choose KandiUg?</span>

        <ul className="flex shrink-0 items-center gap-x-5">
          {promises.map((promise) => (
            <li key={promise} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              <svg
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 text-shop-save"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7" />
              </svg>
              <span className="text-shop-body">{promise}</span>
            </li>
          ))}
        </ul>

        {/* Pushed to the far end and hidden on a phone, where the three
            promises already fill the line and a fourth item would start the
            row scrolling before anything had been read. */}
        <Link
          href="/help"
          className="ml-auto hidden shrink-0 font-medium text-shop-body underline decoration-shop-body/30 underline-offset-[3px] transition-colors hover:text-shop-ink lg:block"
        >
          How buying here works ›
        </Link>
      </div>
    </section>
  );
}
