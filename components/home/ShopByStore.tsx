import Link from "next/link";
import Image from "next/image";
import type { Store } from "@/lib/woocommerce";
import SectionHeader from "@/components/home/SectionHeader";

/**
 * The shops behind the shop.
 *
 * ---- Why this section exists ----
 *
 * Kandi is a marketplace and its homepage never said so. Every rail on the page
 * is products — trending products, new products, discounted products — and a
 * shopper could read the whole thing without learning that the goods come from
 * independent Ugandan stores rather than from one warehouse. That is the single
 * most distinctive fact about this business and it was in the footer, in the
 * nav, and nowhere a shopper actually looks.
 *
 * It is also the honest answer to "what else could this page show". The
 * alternative additions were all more products in a different order, and a
 * seventh rail of the same catalogue does not make a page feel fuller — it
 * makes it feel padded. A row of real sellers adds something the page did not
 * have.
 *
 * ---- It costs nothing to fetch ----
 *
 * `buildHomeFeed` has been calling `getStores()` since it was written and
 * returning `stores.length` from it — one number out of a whole list, with the
 * rest discarded. This renders the list that was already paid for. No new
 * request, no new WordPress round trip.
 *
 * ---- The logo, and the case where there is not one ----
 *
 * A seller's logo is optional in WooCommerce and plenty of stores have none, so
 * the fallback is the normal case rather than an edge. It is the store's
 * initial on the brand's soft tint — the same device `CategoryCircles` used
 * before it was removed, and for the same reason: a broken image is worse than
 * no image, and a grey disc with a letter reads as a designed mark rather than
 * as a photograph that failed.
 */

/** Cards shown before the row stops. The feed caps at twelve; this caps again. */
const SHOWN = 8;

export default function ShopByStore({ stores }: { stores: Store[] }) {
  /* ---- The filter that hid this section entirely ----
   *
   * It was `store.store_slug && store.product_count > 0`, and the second
   * half was wrong in a way that could not fail loudly. `getStores` builds
   * that field as `Number(store.product_count ?? 0) || 0`, so a WordPress
   * install that does not send a per-store count reports zero for EVERY
   * store — the filter removed all of them, the list came out empty, and
   * the section returned null. No error, no empty state, just a section
   * that was never there.
   *
   * A missing count is missing METADATA, not an empty shop. The slug is the
   * only field this row genuinely cannot work without, because it is the
   * link, so it is the only one tested. The count is treated as what it is
   * — optional — and printed only when it says something.
   */
  const open = stores.filter((store) => store.store_slug);

  // Under two this is a row that failed to fill rather than a section. Kept
  // low deliberately: the previous four was a second way for this to vanish
  // on a shop that has sellers, and one silent disappearance is enough.
  if (open.length < 2) return null;

  return (
    /* ---- A ground of its own, and a light one on purpose ----

       This sits directly under the Super Deals ink band, so it cannot be dark
       too: two dark bands touching read as one very tall dark region with a gap
       in the middle, and the page would have a black hole through its lower
       third.

       `shop-hairline` — #f3f4f6, a 4% grey — is the quietest ground that is
       still a ground. It works here where it did NOT work under Super Deals,
       and the difference is what stands on it: these cards are already
       `bg-white` with a hairline ring, so they have their own surface and read
       against a grey. Product tiles above `md` are transparent and do not,
       which is the whole story of that shelf's four attempts.

       Full-bleed via `-mx-`, matched exactly to the column's `px-3 md:px-8`. */
    <section
      aria-labelledby="stores-heading"
      /* A white panel like every other section, where this used to be a grey
         full-bleed band. The grey was chosen to separate this row from the ink
         shelf directly above it without being a second dark region; the canvas
         between the two panels now draws that separation, so the tint was a
         second answer to a question already answered — and it was the reason
         the cards inside had to be white-on-grey rather than simply the
         panel's own surface. */
      className="home-panel"
    >
      <SectionHeader
        id="stores-heading"
        title="Shop by store"
        subtitle="Independent Ugandan sellers, vetted before they can list"
        href="/sellers"
        linkLabel="All stores"
      />

      {/* Two across on a phone, up to four on a desktop. Not a scrolling rail:
          the row is eight cards at most and a track that ends after one swipe
          is a control that promises more than it has — the same argument that
          took the carousels out of the deal panels. */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {open.slice(0, SHOWN).map((store) => (
          <li key={store.id}>
            <Link
              href={`/sellers/${store.store_slug}`}
              className="group flex h-full items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-shop-line transition-colors hover:ring-shop-primary"
            >
              <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-shop-primary-soft ring-1 ring-shop-line">
                {store.logo ? (
                  <Image
                    src={store.logo}
                    alt=""
                    fill
                    // The circle never renders above 44px, so the browser is
                    // told exactly that. A `fill` image with no `sizes` is
                    // fetched as though it were the full viewport — here that
                    // would be eight full-width downloads for eight thumbnails.
                    sizes="44px"
                    quality={90}
                    className="object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-full w-full items-center justify-center text-[16px] font-bold text-shop-primary-ink"
                  >
                    {store.store_name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold leading-tight text-shop-ink transition-colors group-hover:text-shop-primary">
                  {store.store_name}
                </span>
                {/* The count is the useful half. A store name alone is a name;
                    a name with "42 products" behind it is a reason to tap. */}
                {store.product_count > 0 && (
                  <span className="mt-0.5 block text-[12px] leading-tight text-shop-muted">
                    {store.product_count} {store.product_count === 1 ? "product" : "products"}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
