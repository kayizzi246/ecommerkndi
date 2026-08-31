import Image from "next/image";
import Link from "next/link";
import CountdownBlocks from "@/components/home/CountdownBlocks";
import MiniProduct from "@/components/home/MiniProduct";
import PortalAccount from "@/components/home/PortalAccount";
import PortalCategories from "@/components/home/PortalCategories";
import { formatPrice } from "@/lib/currency";
import type { SiteSettings } from "@/lib/site-settings";
import type { CategoryNode, Product } from "@/lib/woocommerce";

/**
 * The portal band — the four-column block that opens the homepage.
 *
 * ---- What it replaces ----
 *
 * A vertical stack. The page used to run banner → rail → shelf → rail → rail →
 * rail → rail → grid, which is nine headings and about six screens before a
 * shopper meets anything they did not have to scroll for. This says the same
 * four things side by side, in one screen:
 *
 *   1. WHERE things are      — the department column
 *   2. WHAT is on            — the campaign panel and the offer chips under it
 *   3. WHAT it costs         — four real prices from the discount pool
 *   4. WHO the shopper is    — sign in, or their own four destinations
 *
 * That is the shape every large marketplace's front page has settled on, and the
 * reason is the same everywhere: those four questions are asked simultaneously,
 * not in sequence, so answering them in sequence spends the only screen every
 * visitor sees on the first one.
 *
 * ---- The columns collapse in a fixed order ----
 *
 * Below `xl` the account panel goes, because it is the one column whose contents
 * are already in the masthead on every page. Below `md` the department column
 * goes too, for the reason given in its own file — its flyout is a pointer
 * idiom — leaving the campaign and the prices, which are the two halves a phone
 * actually needs. Nothing here reflows into a narrow version of itself: each
 * column is either drawn at full strength or not drawn.
 */
export default function PortalBand({
  settings,
  departments,
  /** The discount pool behind the price panel. Four are drawn. */
  deals,
}: {
  settings: SiteSettings;
  departments: CategoryNode[];
  deals: Product[];
}) {
  const { image_url: wide, image_href, image_alt } = settings.banner;

  /* Offers the shop has actually written. `MaximiseSavings` used to render these
     as a four-card cream band halfway down the page; they are three chips under
     the campaign panel now, which is where an offer belongs — beside the thing
     it applies to rather than in a section of its own. Empty is the shipped
     state and draws nothing. */
  const offers = settings.promotions
    .filter((promotion) => promotion.headline)
    .slice(0, 3);

  return (
    <section
      aria-label="Today at Kandi"
      /* ---- The track widths, and why they are what they are ----

         205px is the department column: enough for "Home & Living / Kitchen",
         not enough to become a sidebar. 235px is the account panel, which has to
         hold a 44px avatar beside a name. The two middle tracks split the rest at
         roughly 1.05 : 1 — the campaign panel wants to be the widest thing on the
         row because it is the only artwork, and the price panel wants its four
         thumbnails to land above 100px each, which at this shell they do. */
      className="grid gap-3 md:grid-cols-[205px_minmax(0,1fr)] xl:grid-cols-[205px_minmax(0,1.05fr)_minmax(0,1fr)_235px]"
    >
      <PortalCategories departments={departments} />

      {/* ---- The campaign column ---- */}
      <div className="flex min-h-[260px] flex-col gap-3">
        {wide ? (
          /* An uploaded banner takes the panel whole — no overlaid wording, no
             gradient scrim. Campaign artwork arrives with its own typography
             baked into the pixels, and a headline drawn on top of it is two
             headlines. */
          <Link
            href={image_href || "/sale"}
            className="relative flex-1 overflow-hidden rounded-2xl bg-shop-hairline"
          >
            <Image
              quality={90}
              src={wide}
              alt={image_alt || "Featured offer"}
              fill
              /* The band's widest middle track is about 560px at the 1720 shell,
                 and the full width below md. Stated honestly, because `sizes` is
                 a promise about layout that nothing downstream corrects. */
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 60vw, 560px"
              /* The first paint above the fold, so it is fetched eagerly at a
                 high priority rather than preloaded: `priority` is deprecated in
                 Next 16, and a preload link is explicitly the wrong tool when
                 which element is the LCP depends on the viewport. */
              loading="eager"
              fetchPriority="high"
              className="object-cover"
            />
          </Link>
        ) : (
          /* ---- The shipped state, and it has to stand on its own ----

             No banner is uploaded on this shop today, so this is what the middle
             of the band actually renders. It is built from the same four settings
             fields the uploaded banner replaces — eyebrow, headline, label, url —
             so a shop that never opens the settings screen still gets a campaign
             panel rather than a hole in the front page. */
          <Link
            href={settings.banner.cta_url || "/sale"}
            className="group relative flex flex-1 flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-shop-primary to-shop-ember p-6 text-white"
          >
            {/* Two soft discs, bottom right. The panel is a flat gradient
                otherwise, and a flat gradient at this size reads as an image
                that failed to load; the discs are what say it was drawn on
                purpose. `aria-hidden` because they carry nothing. */}
            <span
              aria-hidden
              className="absolute -bottom-16 -right-10 h-52 w-52 rounded-full bg-white/10"
            />
            <span
              aria-hidden
              className="absolute -bottom-4 right-16 h-24 w-24 rounded-full bg-white/10"
            />

            <span className="relative text-[12px] font-bold uppercase tracking-[0.14em] text-white/85">
              {settings.banner.eyebrow}
            </span>
            <span className="hero-display relative mt-1.5 max-w-[15ch] text-[30px] leading-[1.08] tracking-[-0.02em] md:text-[38px]">
              {settings.banner.headline}
            </span>
            <span className="relative mt-2 max-w-[34ch] text-[13.5px] leading-snug text-white/90">
              {`Free delivery over ${formatPrice(settings.commerce.free_delivery_from)} · pay on delivery · ${settings.commerce.returns_days}-day returns`}
            </span>
            <span className="relative mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-5 py-2 text-[13.5px] font-bold text-shop-primary-ink transition-transform duration-200 ease-out group-hover:translate-x-0.5">
              {settings.banner.cta_label}
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        )}

        {offers.length > 0 && (
          /* Flex with equal `flex-1` children rather than `grid-cols-3`. The
             shop writes between one and three of these, and a fixed three-column
             grid holding one chip leaves two thirds of the row empty — which
             reads as two offers that failed to load rather than as one offer. */
          <ul className="flex gap-2">
            {offers.map((offer) => (
              <li key={offer.headline} className="min-w-0 flex-1">
                <Link
                  href={offer.url || "/sale"}
                  className="flex h-full flex-col justify-center rounded-xl bg-white px-3 py-2.5 ring-1 ring-shop-line transition-colors hover:ring-shop-primary"
                >
                  {offer.badge && (
                    <span className="mb-1 w-fit rounded bg-shop-ink px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-white">
                      {offer.badge}
                    </span>
                  )}
                  <span className="truncate text-[12.5px] font-bold text-shop-ink">
                    {offer.headline}
                  </span>
                  {/* The qualifying half of an offer. "Extra 20% off" is the
                      hook; "on toys, over UGX 50,000" is what it means, and a
                      chip that prints only the first is the kind shoppers stop
                      believing after the second time. */}
                  {offer.note && (
                    <span className="truncate text-[11px] text-shop-muted">
                      {offer.note}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- The price panel ----

          The reference gives this slot to "billions in subsidies, price
          guaranteed"; the honest Ugandan equivalent is the shop's own deepest
          cuts with the prices showing. It draws nothing when there are fewer
          than four discounts to show, so a shop running no sale gets a
          three-column band rather than an empty promise. */}
      {deals.length >= 4 && (
        <div className="flex h-full flex-col rounded-2xl bg-white p-4 ring-1 ring-shop-line md:col-span-2 xl:col-span-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[14px] font-bold leading-tight text-shop-ink">
              Today&rsquo;s deepest cuts
              <span className="ml-1.5 font-medium text-shop-muted">
                — the biggest reductions in the shop right now
              </span>
            </p>
            {/* The clock runs to midnight on the READER'S own device rather than
                to a fresh 24 hours from whenever they arrived. See the
                component: the distinction is the whole honesty of it. */}
            <span className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-shop-primary-soft px-2 py-1 text-shop-primary-ink sm:flex">
              <span className="text-[11.5px] font-semibold">Ends in</span>
              <CountdownBlocks />
            </span>
          </div>

          <ul className="grid flex-1 grid-cols-4 gap-2.5">
            {deals.slice(0, 4).map((product) => (
              <li key={product.id}>
                <MiniProduct
                  product={product}
                  sizes="(max-width: 768px) 24vw, (max-width: 1280px) 22vw, 120px"
                />
              </li>
            ))}
          </ul>

          <Link
            href="/sale"
            className="mt-3 block text-[12.5px] font-semibold text-shop-primary hover:underline"
          >
            All deals →
          </Link>
        </div>
      )}

      <PortalAccount
        freeDeliveryLabel={formatPrice(settings.commerce.free_delivery_from)}
      />
    </section>
  );
}
