import Link from "next/link";

/**
 * The channel strip: the shop's dozen destinations, as icons, above everything
 * else on the page.
 *
 * ---- What this replaces, and why it is not the category row again ----
 *
 * A category row has been added to and removed from the top of this page five
 * times, and the reason it kept failing is recorded at length in the history:
 * it needed a photograph per category, the catalogue could not supply one for
 * half of them, and the row rendered as six products and six coloured letters.
 *
 * This is a different thing wearing a similar shape. Every entry is a
 * DESTINATION the shop already has — a page that exists, is populated, and has
 * a fixed meaning — so nothing here depends on what the catalogue happens to
 * hold this week. The icons are drawn rather than fetched, which is what makes
 * the row survive an empty department, and each is a flat two-colour mark at
 * 20px because anything more detailed is mud at that size.
 *
 * ---- Why it is above the portal band rather than inside it ----
 *
 * It is the page's second navigation, after the masthead, and both belong at
 * the top edge. Put it below the band and it becomes a row of buttons in the
 * middle of the merchandise, which is the thing the removed category grids were
 * each guilty of.
 */

/** One channel. `tint` is the icon disc; the label is always ink. */
type Channel = {
  label: string;
  href: string;
  tint: string;
  icon: React.ReactNode;
};

/* 20px, `currentColor`, 1.8 stroke — the weight the masthead icons use, so the
   two rows of navigation read as one set rather than two. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="h-[19px] w-[19px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const CHANNELS: Channel[] = [
  {
    label: "Super Deals",
    href: "/sale",
    tint: "bg-shop-primary-soft text-shop-primary-ink",
    icon: (
      <Glyph>
        <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
      </Glyph>
    ),
  },
  {
    label: "New in",
    href: "/search?sort=newest",
    tint: "bg-pop-green-soft text-shop-save",
    icon: (
      <Glyph>
        <path d="M12 3v18M3 12h18" />
      </Glyph>
    ),
  },
  {
    label: "Best sellers",
    href: "/search?sort=popular",
    tint: "bg-pop-blue-soft text-pop-blue",
    icon: (
      <Glyph>
        <path d="M6 20V10M12 20V4M18 20v-7" />
      </Glyph>
    ),
  },
  {
    label: "Top rated",
    href: "/search?sort=rating",
    tint: "bg-pop-violet-soft text-pop-violet",
    icon: (
      <Glyph>
        <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />
      </Glyph>
    ),
  },
  {
    label: "Shop by store",
    href: "/sellers",
    tint: "bg-shop-primary-soft text-shop-primary-ink",
    icon: (
      <Glyph>
        <path d="M4 9h16l-1 11H5L4 9Z" />
        <path d="M8 9V6a4 4 0 0 1 8 0v3" />
      </Glyph>
    ),
  },
  {
    label: "All categories",
    href: "/categories",
    tint: "bg-shop-surface text-shop-ink",
    icon: (
      <Glyph>
        <path d="M4 5h7v7H4V5ZM13 5h7v7h-7V5ZM4 14h7v5H4v-5ZM13 14h7v5h-7v-5Z" />
      </Glyph>
    ),
  },
  {
    label: "Free delivery",
    href: "/shipping",
    tint: "bg-pop-green-soft text-shop-save",
    icon: (
      <Glyph>
        <path d="M3 7h11v9H3V7ZM14 10h4l3 3v3h-7v-6Z" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17" cy="18" r="1.6" />
      </Glyph>
    ),
  },
  {
    label: "Track order",
    href: "/track-order",
    tint: "bg-pop-blue-soft text-pop-blue",
    icon: (
      <Glyph>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </Glyph>
    ),
  },
  {
    label: "Sell on Kandi",
    href: "/sell",
    tint: "bg-shop-surface text-shop-ink",
    icon: (
      <Glyph>
        <path d="M4 20h16M7 20V9M12 20V4M17 20v-7" />
      </Glyph>
    ),
  },
];

export default function ChannelRow() {
  return (
    <nav
      aria-label="Shop sections"
      className="border-b border-shop-line bg-white"
    >
      {/* ---- It scrolls on a phone rather than wrapping ----

          Nine channels wrapped onto three rows is a 150px block of navigation
          above the first product, which is exactly the failure the removed
          category grids kept producing. One scrolling row is 64px on any screen,
          and the four that fit are the four this shop most wants tapped.

          `justify-center` from lg, where all nine fit at once and a left-ranged
          row would leave a third of the strip empty. */}
      <ul className="no-scrollbar mx-auto flex max-w-[var(--shell)] items-start gap-1 overflow-x-auto px-3 py-2.5 md:px-8 lg:justify-center lg:gap-3">
        {CHANNELS.map((channel) => (
          <li key={channel.label} className="shrink-0">
            <Link
              href={channel.href}
              className="group flex w-[74px] flex-col items-center gap-1.5 rounded-xl px-1 py-1 text-center transition-colors hover:bg-shop-hairline md:w-[92px]"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover:-translate-y-0.5 ${channel.tint}`}
              >
                {channel.icon}
              </span>
              <span className="w-full truncate text-[11px] font-semibold leading-tight text-shop-ink transition-colors group-hover:text-shop-primary md:text-[12px]">
                {channel.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
