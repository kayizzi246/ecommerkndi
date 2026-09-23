import Link from "next/link";
import CountdownBlocks from "@/components/home/CountdownBlocks";
import MiniProduct from "@/components/home/MiniProduct";
import PortalAccount from "@/components/home/PortalAccount";
import PortalCategories from "@/components/home/PortalCategories";
import { formatPrice } from "@/lib/currency";
import type { SiteSettings } from "@/lib/site-settings";
import type { CategoryNode, Product } from "@/lib/woocommerce";

/**
 * The portal band — the three-column block under the hero.
 *
 *   1. WHERE things are   — the department column
 *   2. WHAT it costs      — the deepest cuts in the shop, prices showing
 *   3. WHO the shopper is — sign in, or their own four destinations
 *
 * The campaign panel that used to sit between the first two is the hero now
 * (`HeroBanner`), full width above this band, and the offer chips went with it.
 * What that buys the band is room: the price panel takes the whole middle track
 * and shows six deals rather than four.
 *
 * ---- The columns collapse in a fixed order ----
 *
 * Below `xl` the account panel goes, because it is the one column whose contents
 * are already in the masthead on every page. Below `md` the department column
 * goes too, for the reason given in its own file — its flyout is a pointer
 * idiom — leaving the prices, which is the half a phone actually needs. Nothing
 * here reflows into a narrow version of itself: each column is either drawn at
 * full strength or not drawn.
 */
export default function PortalBand({
  settings,
  departments,
  /** The discount pool behind the price panel. Six are drawn. */
  deals,
}: {
  settings: SiteSettings;
  departments: CategoryNode[];
  deals: Product[];
}) {
  return (
    <section
      aria-label="Today at Kandi"
      /* 205px is the department column: enough for "Home & Living / Kitchen",
         not enough to become a sidebar. 235px is the account panel, which has
         to hold a 44px avatar beside a name. The middle track takes the rest. */
      /* `phone-gutter`: these are rounded cards with a shadow, and a rounded
         card hard against the screen edge reads as a card that has been cut
         off. The page column below has no gutter of its own any more — see
         the note on that class in globals.css. */
      className="phone-gutter grid gap-3 md:grid-cols-[205px_minmax(0,1fr)] xl:grid-cols-[205px_minmax(0,1fr)_235px]"
    >
      <PortalCategories departments={departments} />

      {/* ---- The price panel ----

          The shop's own deepest cuts with the prices showing. It draws nothing
          when there are fewer than four discounts to show, so a shop running no
          sale gets a two-column band rather than an empty promise. */}
      {deals.length >= 4 && (
        <div className="flex h-full flex-col rounded-2xl bg-white p-2.5 ring-1 ring-shop-edge md:p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold leading-tight text-shop-ink sm:text-[13px]">
              Today&rsquo;s deepest cuts
              <span className="ml-1.5 hidden font-medium text-shop-muted sm:inline">
                — the biggest reductions in the shop right now
              </span>
            </p>
            {/* The clock runs to midnight on the READER'S own device rather than
                to a fresh 24 hours from whenever they arrived. See the
                component: the distinction is the whole honesty of it. The
                digits are red — the same `--color-shop-price-was` the struck
                prices below use — and the label beside them stays grey, so the
                panel spends one extra hue rather than two. */}
            <span className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-0.5">
              <span className="text-[10px] font-semibold text-shop-muted">Ends in</span>
              <CountdownBlocks />
            </span>
          </div>

          {/* ---- Three on a phone, six from md ----

              Three across a 360px screen inside a panel that pays its own
              padding is a ~105px cell, which is the size a price is still read
              at. The middle track is the widest thing on the band from md, so
              it takes six — the fourth, fifth and sixth are still fetched and
              rendered and simply not drawn below md, so the markup is one thing
              with three items hidden rather than two layouts. */}
          <ul className="grid flex-1 grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-6 lg:flex-none">
            {deals.slice(0, 6).map((product, index) => (
              <li key={product.id} className={index >= 3 ? "hidden md:block" : undefined}>
                <MiniProduct
                  product={product}
                  sizes="(max-width: 640px) 30vw, (max-width: 768px) 30vw, (max-width: 1280px) 14vw, 150px"
                />
              </li>
            ))}
          </ul>

          <div className="mt-auto flex items-center justify-between gap-3 pt-2.5">
            {/* The threshold, read from wp-admin, so a shop that changes it
                changes this line with it. */}
            <span className="hidden text-[11px] text-shop-muted md:inline">
              Free delivery over{" "}
              <span className="font-semibold text-shop-ink">
                {formatPrice(settings.commerce.free_delivery_from)}
              </span>
            </span>
            <Link
              href="/sale"
              className="text-[12px] font-semibold text-shop-primary hover:underline"
            >
              All deals →
            </Link>
          </div>
        </div>
      )}

      <PortalAccount
        freeDeliveryLabel={formatPrice(settings.commerce.free_delivery_from)}
      />
    </section>
  );
}
