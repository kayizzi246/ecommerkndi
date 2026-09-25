import HeroMosaic from "@/components/home/HeroMosaic";
import PortalAccount from "@/components/home/PortalAccount";
import PortalCategories from "@/components/home/PortalCategories";
import { formatPrice } from "@/lib/currency";
import type { SiteSettings } from "@/lib/site-settings";
import type { CategoryNode, Product } from "@/lib/woocommerce";

/**
 * The portal band — the three-column block under the hero.
 *
 *   1. WHERE things are   — the department column
 *   2. WHAT is new        — the newest products in the shop, prices showing
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
  /** The catalogue newest first, behind the "Just in" panel. Six are drawn. */
  newest,
  deals,
  bestSellers,
}: {
  settings: SiteSettings;
  departments: CategoryNode[];
  newest: Product[];
  deals: Product[];
  bestSellers: Product[];
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

      {/* The Taobao-style mosaic: two campaign banners and a promise strip,
          then four small shelves. See `HeroMosaic`. */}
      <HeroMosaic deals={deals} newest={newest} bestSellers={bestSellers} />

      <PortalAccount
        freeDeliveryLabel={formatPrice(settings.commerce.free_delivery_from)}
      />
    </section>
  );
}
