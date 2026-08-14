import type { Product } from "@/lib/woocommerce";
import type { SiteSettings } from "@/lib/site-settings";
import { formatPrice } from "@/lib/currency";

/**
 * The paragraph and questions that sit under a category's grid.
 *
 * ## Why a listing page needs prose at all
 *
 * A category page ships an `<h1>`, a filter rail and forty product names. That
 * is a good page for a shopper and a nearly empty one for Google: the only text
 * on it matching "football jerseys in Uganda" is the heading, and one heading
 * does not outrank a competitor whose page answers the question in sentences.
 * The homepage was given exactly this treatment for exactly this reason — the
 * about block at the foot of `app/page.tsx` — and the category pages, which are
 * the ones that rank for what people actually type, never got it.
 *
 * ## Why it is generated rather than written
 *
 * Every figure comes from the catalogue and from wp-admin: the number of
 * listings, the real price range of what is on the page, the free-delivery
 * threshold the checkout charges against, the returns window the returns page
 * quotes. Nothing is a claim somebody has to remember to update, and nothing
 * can drift away from what the shop actually does — which is the difference
 * between text that earns a ranking and text that earns a manual action.
 */

export type Faq = { q: string; a: string };

/**
 * The questions, built once and used twice — rendered below, and serialised
 * into the page's JSON-LD by the caller.
 *
 * One function rather than two so the two copies cannot drift apart. Google
 * discards FAQ structured data whose answers are not visible on the page, and
 * the ordinary way that happens is somebody editing the paragraph and not the
 * markup.
 */
export function categoryFaqs({
  name,
  total,
  products,
  settings,
}: {
  name: string;
  total: number;
  products: Product[];
  settings: SiteSettings;
}): Faq[] {
  const lower = name.toLowerCase();
  const range = priceRange(products);
  const { free_delivery_from: freeFrom, returns_days: returnsDays } = settings.commerce;

  return [
    {
      q: `How much do ${lower} cost in Uganda?`,
      a: range
        ? `On KandiUg, ${lower} are priced ${range} across ${total} ${
            total === 1 ? "listing" : "listings"
          } — from our own shelves and from vetted Ugandan sellers.`
        : `Prices vary by brand and size. Every listing on this page shows its price, and any reduction, before you add it to the basket.`,
    },
    {
      q: `Do you deliver ${lower} outside Kampala?`,
      a:
        `Yes — we deliver countrywide. Orders around Kampala usually arrive ` +
        `within one to two working days and upcountry within five, and ` +
        `delivery is free on orders over ${formatPrice(freeFrom)}.`,
    },
    {
      q: `Can I pay on delivery?`,
      a:
        `Yes. Pay cash to the courier when your order arrives, or use MTN ` +
        `Mobile Money, Airtel Money or a card at checkout.`,
    },
    {
      q: `What if it does not fit?`,
      a:
        `You have ${returnsDays} days from delivery to send an item back. If ` +
        `it arrives faulty or is not what you ordered, we cover the courier ` +
        `both ways.`,
    },
  ];
}

/**
 * "from UGX 28,000 to UGX 90,000", or null when the page has no prices.
 *
 * A range is only quoted when there is more than one price to quote: "from UGX
 * 28,000 to UGX 28,000" tells a reader the page was assembled by a machine,
 * which is the one impression this block cannot afford to give.
 */
function priceRange(products: Product[]): string | null {
  const prices = products.map((product) => product.price).filter((price) => price > 0);
  if (prices.length === 0) return null;

  const low = Math.min(...prices);
  const high = Math.max(...prices);

  return low === high
    ? `at ${formatPrice(low)}`
    : `from ${formatPrice(low)} to ${formatPrice(high)}`;
}

export default function CategoryIntro({
  name,
  total,
  products,
  settings,
  faqs,
}: {
  /** The department's real name from WooCommerce — "Football Jerseys". */
  name: string;
  /** How many listings the category holds, across every page. */
  total: number;
  /** The products on this page, for a truthful price range. */
  products: Product[];
  settings: SiteSettings;
  /** The same array the page put in its JSON-LD. */
  faqs: Faq[];
}) {
  const lower = name.toLowerCase();
  const range = priceRange(products);
  const { free_delivery_from: freeFrom, returns_days: returnsDays } = settings.commerce;

  return (
    <section
      aria-labelledby="category-about"
      className="mt-12 border-t border-shop-line px-3 pt-8 md:px-0"
    >
      {/* An `<h2>`, never a second `<h1>`. The heading above the grid is the
          page's subject; this is a section of it. */}
      <h2 id="category-about" className="heading-black text-[18px] text-shop-ink md:text-[20px]">
        Buying {lower} in Uganda
      </h2>

      <div className="mt-3 max-w-[70ch] space-y-3.5 text-[15px] leading-relaxed text-shop-body">
        <p>
          KandiUg lists{" "}
          <strong className="font-semibold text-shop-ink">
            {total} {lower} {total === 1 ? "listing" : "listings"}
          </strong>
          {range ? ` ${range}` : ""}, sold from our own shelves and by
          independent Ugandan stores approved to sell alongside us. Every listing
          is checked before it goes live and every seller is vetted individually,
          so a low price here is a real one rather than a risk.
        </p>
        <p>
          We deliver countrywide, with{" "}
          <span className="font-semibold text-shop-ink">
            free delivery on orders over {formatPrice(freeFrom)}
          </span>
          . Pay however suits you — cash to the courier on delivery, MTN Mobile
          Money, Airtel Money, or by card at checkout — and you have{" "}
          {returnsDays} days to send anything back.
        </p>
      </div>

      <dl className="mt-6 max-w-[70ch] space-y-4">
        {faqs.map((faq) => (
          <div key={faq.q}>
            <dt className="text-[15px] font-semibold text-shop-ink">{faq.q}</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-shop-body">{faq.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
