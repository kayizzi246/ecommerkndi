import Link from "next/link";
import type { SiteSettings } from "@/lib/site-settings";
import type { CategoryNode } from "@/lib/woocommerce";
import { formatPrice } from "@/lib/currency";
import AppStoreBadges from "@/components/AppStoreBadges";

/**
 * How many departments the footer lists.
 *
 * Enough to give every significant category a link from every page, few enough
 * that the column stays a column. `buildCategoryTree` returns them sorted by
 * product count, so this keeps the ones with stock behind them.
 */
const FOOTER_DEPARTMENTS = 8;

const COLUMNS = [
  {
    title: "Customer Service",
    items: [
      { name: "Help centre", href: "/help" },
      { name: "Delivery information", href: "/shipping" },
      { name: "Returns & refunds", href: "/returns" },
      { name: "Track your order", href: "/track-order" },
      { name: "Contact us", href: "/contact" },
    ],
  },
  {
    title: "About Kandi",
    items: [
      { name: "Our story", href: "/about" },
      { name: "Careers", href: "/careers" },
      { name: "Shop by store", href: "/sellers" },
      { name: "Terms & conditions", href: "/terms" },
      { name: "Privacy policy", href: "/privacy" },
    ],
  },
  {
    title: "Sell With Us",
    items: [
      { name: "Become a seller", href: "/sell" },
      { name: "Seller centre", href: "/seller" },
      { name: "Seller policies", href: "/seller-policies" },
    ],
  },
];

/** Only the networks the shop has actually filled in are rendered. */
const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
};

export default function Footer({
  settings,
  departments = [],
}: {
  settings: SiteSettings;
  /**
   * The department tree, for the shop-by-department column.
   *
   * The footer previously carried no link to a single category or product. That
   * left the mega-menu — which opens on hover, and is a client component — as
   * the only route from most of the site into the catalogue, so a crawler
   * reading the static HTML of a policy page found no way down into the shop at
   * all. These links are on every page, in the markup, and they are also the
   * fastest route back to shopping for a reader who has just finished the
   * returns policy.
   */
  departments?: CategoryNode[];
}) {
  const { support, social, commerce, brand, app } = settings;

  const shopDepartments = departments
    .filter((department) => (department.count ?? 0) > 0)
    .slice(0, FOOTER_DEPARTMENTS);

  /* ---- The four promises, in one colour instead of four ----

     These headings were green, blue, violet and orange — one hue each, in a
     row, on black. Four hues picked to fill four slots rather than to mean
     anything: nothing distinguishes returns-blue from payments-violet except
     that they had to differ, and the row read as a set of unrelated badges
     rather than as one statement the shop is making four times.

     They are one ink now, with the icon carrying the single accent. That is the
     same rule the rest of the shop follows — see the ONE ACCENT note on /sell —
     and it is what lets the row be read as a group rather than scanned as four
     separate objects.

     The icons are what the colour was really for: a promise row wants a shape
     the eye can catch at the foot of a long page, and a 16px stroked glyph does
     that without spending a hue on it. */
  const serviceStrip = [
    {
      title: "Free delivery",
      copy: `On orders over ${formatPrice(commerce.free_delivery_from)}`,
      icon: "M3 7.5A1.5 1.5 0 0 1 4.5 6h8A1.5 1.5 0 0 1 14 7.5V15H3V7.5ZM14 9h2.8a1.5 1.5 0 0 1 1.39.93L19 12v3h-5V9M7 17.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm11 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
    },
    {
      title: "Easy returns",
      copy: `${commerce.returns_days} days to change your mind`,
      icon: "M3 9h13a4.5 4.5 0 0 1 0 9h-6M3 9l4-4M3 9l4 4",
    },
    {
      title: "Secure payments",
      copy: "Cash, MTN MoMo, Airtel Money, Visa",
      icon: "M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 15.5v-7Zm0 2.5h18M6.5 14.5h3",
    },
    {
      title: "Need help?",
      copy: `Call ${support.phone}`,
      icon: "M4 5.5A1.5 1.5 0 0 1 5.5 4h2.1a1 1 0 0 1 .96.73l.8 2.8a1 1 0 0 1-.42 1.1l-1.3.87a12 12 0 0 0 5.36 5.36l.87-1.3a1 1 0 0 1 1.1-.42l2.8.8a1 1 0 0 1 .73.96v2.1A1.5 1.5 0 0 1 17 18.5h-.5A12.5 12.5 0 0 1 4 6V5.5Z",
    },
  ];

  const socialLinks = Object.entries(social).filter(([, url]) => Boolean(url));

  return (
    /* ---- `bg-shop-footer` is light now ----

       It was #000, on the argument recorded in `globals.css`: under warm
       photography and an orange masthead a tinted near-black would read as a
       third hue, and white on black is 21:1 so every step of white gained
       contrast. Both points are true and neither was the question.

       The question is what a shopper sees. A black slab under a light page is
       the largest dark object on the site, and it is most of what "the shop
       looks dark" means — the page is light and the thing at the bottom of it
       is not. So the footer takes the deepest step of the same warm ramp the
       canvas is drawn from, and the page ends by getting slightly warmer rather
       than by falling off a cliff.

       Type went back to the shop's ink ramp on the way, which is where every
       contrast ratio in `globals.css` was calculated: headings at `shop-ink`
       (15:1) and everything else at `shop-body` (6.6:1 on the legal bar, which is
       the deepest tone here). `shop-muted` is deliberately NOT used: it is 4.8:1
       on white and 4.2:1 on this cream, so the one grey that was fine on the old
       black ground is the one grey that fails on the new one. The two on-dark
       accents went the same way — `pop-orange-on-dark` and
       `pop-green-on-dark` exist to be legible on black and are far too pale for
       cream, so the offers link is `shop-primary-ink` (5:1 here, where the raw
       `shop-primary` is 2.8) and WhatsApp is `shop-save`.

       ---- What the redesign actually changed ----

       The height, and where it was being spent. This footer ran to roughly 620px
       on a desktop, and most of that was one column: "Talk to us" carried the
       phone, the email, WhatsApp, hours, an address, an app heading, a
       paragraph, two store badges AND the social pills, while the four beside it
       ran five links each and stopped. A five-column grid where one column is
       three times the height of its neighbours is not a grid; it is a column
       with four short ones parked next to it, and every row of white space down
       the right of the other four was the cost of that.

       So the tail of that column — the app block and the social row — came out
       and became a bar of its own below the grid, where the two of them sit on
       one line facing each other. The five columns are now roughly even, the
       footer lost about a third of its height, and the app badges are more
       visible rather than less: they are on their own line instead of buried at
       the bottom of the fifth column.

       Padding came down with it, everywhere: py-7 → py-5 on the promises,
       py-11 → py-8 on the grid, py-5 → py-3.5 on the legal bar, and the
       `mt-14` above the whole thing → mt-10.

       ---- And a second pass, on the type ----

       Everything here is navigation of last resort. A footer link is not read,
       it is scanned for by somebody who already knows the word they are
       looking for — "returns", "contact" — so it wants to be findable rather
       than legible at arm's length. 13px was the shop's body size, which put
       forty links at the weight of a paragraph and made the footer the second
       heaviest block on every page.

       12.5px on the links, 11.5px on the column headings, 11.5 on the promises
       and 12 on the legal bar, with the padding pulled in one step again at
       each of the four bands. Nothing here drops below 11.5: these are still
       links people tap on a phone, and the tap target is the line height. */
    <footer className="site-footer mt-8 bg-shop-footer text-shop-body">
      {/* Service promises */}
      <div className="border-b border-shop-edge">
        <div className="mx-auto grid max-w-[var(--shell)] gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4 md:px-8">
          {serviceStrip.map((item) => (
            <div key={item.title} className="flex items-start gap-2.5">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-px h-[18px] w-[18px] shrink-0 text-shop-primary-ink"
              >
                <path d={item.icon} />
              </svg>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold leading-tight text-shop-ink">{item.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-tight text-shop-body">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Link columns */}
      <div className="mx-auto grid max-w-[var(--shell)] gap-x-6 gap-y-5 px-4 py-6 sm:grid-cols-2 lg:grid-cols-5 md:px-8">
        {shopDepartments.length > 0 && (
          <div>
            <h2 className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-shop-ink">
              Shop by department
            </h2>
            <ul className="space-y-1 text-[12.5px] leading-snug text-shop-body">
              {shopDepartments.map((department) => (
                <li key={department.id}>
                  <Link
                    className="hover:text-shop-primary-ink hover:underline"
                    href={`/category/${department.slug}`}
                  >
                    {department.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link className="font-semibold text-shop-ink hover:text-shop-primary-ink hover:underline" href="/categories">
                  All categories
                </Link>
              </li>
              <li>
                {/* The sale page belongs in the footer for the same reason it
                    belongs in the nav: it is the highest-converting page on the
                    shop, and it was reachable from the homepage alone. */}
                <Link className="font-semibold text-shop-primary-ink hover:underline" href="/sale">
                  Today&rsquo;s offers
                </Link>
              </li>
            </ul>
          </div>
        )}

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-shop-ink">
              {column.title}
            </h2>
            <ul className="space-y-1 text-[12.5px] leading-snug text-shop-body">
              {column.items.map((item) => (
                <li key={item.name}>
                  <Link className="hover:text-shop-primary-ink hover:underline" href={item.href}>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div id="kandi-app">
          <h2 className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-shop-ink">
            Talk to us
          </h2>
          <ul className="space-y-1 text-[12.5px] leading-snug text-shop-body">
            <li>
              <a className="hover:text-shop-primary-ink hover:underline" href={`tel:${support.phone.replace(/\s/g, "")}`}>
                {support.phone}
              </a>
            </li>
            <li>
              <a className="hover:text-shop-primary-ink hover:underline" href={`mailto:${support.email}`}>
                {support.email}
              </a>
            </li>
            {support.whatsapp && (
              <li>
                <a
                  className="font-semibold text-shop-save hover:underline"
                  href={`https://wa.me/${support.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Chat on WhatsApp
                </a>
              </li>
            )}
            <li className="text-shop-body">{support.hours}</li>
            <li className="text-shop-body">{support.address}</li>
          </ul>
        </div>
      </div>

      {/* ---- The app and the socials, on one line ----

           Both of these used to hang off the bottom of the "Talk to us" column,
           which is what made that column three times the height of the four
           beside it. Neither is column material: an app badge is a ~44px-tall
           object and the socials are a row of pills, and stacking them in a
           200px gutter is what forced the whole grid to that column's height.

           Given the full width they face each other — app left, socials right —
           and the pair costs one line instead of a third of the footer. The
           badges are also more visible for it, not less: they were previously
           the last thing in the fifth column of a five-column grid.

           The app paragraph went with them. "Shop faster and track every order
           from your phone", set beside two buttons reading App Store and Google
           Play, is a sentence explaining an icon — and the heading next to it
           already says which of the two states this is in. */}
      <div className="border-t border-shop-edge">
        <div className="mx-auto flex max-w-[var(--shell)] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <h2 className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-shop-ink">
              {app.available ? "Get the app" : "App coming soon"}
            </h2>
            <AppStoreBadges app={app} />
          </div>

          {socialLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-shop-ink">
                Follow us
              </h2>
              {socialLinks.map(([network, url]) => (
                <a
                  key={network}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  /* The one literal fill in the footer, and the one thing the
                     token swap above cannot reach. A white pill on a black
                     ground is a hole; 6% white is the same lift the rest of the
                     dark surfaces use. */
                  className="rounded-full border border-shop-edge bg-white/[0.06] px-2.5 py-1 text-[11.5px] font-semibold text-shop-body transition-colors hover:border-shop-primary hover:text-shop-primary-ink"
                >
                  {SOCIAL_LABELS[network] ?? network}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legal bar */}
      {/* The legal bar is its own token rather than `shop-ink`, which is the
          TYPE colour and only ever coincidentally the same value. Now that the
          footer is black the strip lifts a hair instead of dropping — see the
          token in `globals.css` — and the hairline above carries the join. */}
      <div className="border-t border-shop-edge bg-shop-footer-deep">
        <div className="mx-auto flex max-w-[var(--shell)] flex-col gap-1.5 px-4 py-3 text-[12px] text-shop-body md:flex-row md:items-center md:justify-between md:px-8">
          {/* "KandiUg" here as well as on the homepage: a legal bar is on every
              page of the site, which is what turns one mention of the name
              people search into a site-wide one. */}
          <span>
            © {new Date().getFullYear()} {brand.name} Uganda (KandiUg). All rights reserved.
          </span>
          <span className="text-shop-body">
            Cash on delivery · MTN MoMo · Airtel Money · Visa · Mastercard
          </span>
        </div>
      </div>
    </footer>
  );
}
