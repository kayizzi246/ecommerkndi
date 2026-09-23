import Link from "next/link";

/**
 * The channel strip: the shop's nine destinations, as chips, under the hero
 * and the trust bar.
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
 * ---- Where it sits ----
 *
 * Third on the page: the hero opens it, the trust bar answers "why here", and
 * this row answers "where to". It stays above the first product — below the
 * merchandise it would be a row of buttons in the middle of the shelves, which
 * is the thing the removed category grids were each guilty of.
 */

/**
 * One channel. `tint` is the chip's ground and text colour.
 *
 * ---- Why almost all of them are the same grey ----
 *
 * This row had five: orange, green, blue, violet and grey, assigned to nine
 * destinations. Nothing chose those colours — "Best sellers" is not blue in any
 * sense a shopper could name — and a rank of unrelated pastels across the top of
 * a page is the arrangement that reads as generated rather than designed.
 *
 * Colour is kept for one entry: Super Deals, which is the only one of the nine
 * making a claim about price rather than naming a place. The rest are places,
 * and a place is not a colour — they are told apart by their icon and their
 * label, which is what a shopper reads anyway.
 */
type Channel = {
  label: string;
  href: string;
  tint: string;
  icon: React.ReactNode;
};

/* 18px, `currentColor`, 1.8 stroke — the weight the masthead icons use, so the
   two rows of navigation read as one set rather than two. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0"
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
    tint: "bg-shop-primary-soft text-shop-primary-ink ring-shop-primary/25",
    icon: (
      <Glyph>
        <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
      </Glyph>
    ),
  },
  {
    label: "New in",
    href: "/search?sort=newest",
    tint: "bg-white text-shop-body hover:text-shop-primary",
    icon: (
      <Glyph>
        <path d="M12 3v18M3 12h18" />
      </Glyph>
    ),
  },
  {
    label: "Best sellers",
    href: "/search?sort=popular",
    tint: "bg-white text-shop-body hover:text-shop-primary",
    icon: (
      <Glyph>
        <path d="M6 20V10M12 20V4M18 20v-7" />
      </Glyph>
    ),
  },
  {
    label: "Top rated",
    href: "/search?sort=rating",
    tint: "bg-white text-shop-body hover:text-shop-primary",
    icon: (
      <Glyph>
        <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />
      </Glyph>
    ),
  },
  {
    label: "Shop by store",
    href: "/sellers",
    tint: "bg-white text-shop-body hover:text-shop-primary",
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
    tint: "bg-white text-shop-ink hover:text-shop-primary",
    icon: (
      <Glyph>
        <path d="M4 5h7v7H4V5ZM13 5h7v7h-7V5ZM4 14h7v5H4v-5ZM13 14h7v5h-7v-5Z" />
      </Glyph>
    ),
  },
  {
    label: "Free delivery",
    href: "/shipping",
    tint: "bg-white text-shop-body hover:text-shop-primary",
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
    tint: "bg-white text-shop-body hover:text-shop-primary",
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
    tint: "bg-white text-shop-ink hover:text-shop-primary",
    icon: (
      <Glyph>
        <path d="M4 20h16M7 20V9M12 20V4M17 20v-7" />
      </Glyph>
    ),
  },
];

export default function ChannelRow() {
  return (
    <nav aria-label="Shop sections">
      {/* ---- Chips on one line, not tiles in a rank ----

          This was nine 74px tiles, each a 40px disc above a caption — a 64px
          block on every screen, and on a phone four of them visible with five
          more off the side of it. Laid out horizontally instead, a channel is
          the icon and its label on ONE line, so the row is ~38px, six fit on a
          phone rather than four, and the strip stops competing with the trust
          bar directly above it for the same vertical space.

          It still scrolls rather than wrapping. Nine channels wrapped onto
          three rows is a 150px block of navigation above the first product,
          which is exactly the failure the removed category grids kept
          producing.

          `justify-center` from lg, where all nine fit at once and a left-ranged
          row would leave a third of the strip empty. */}
      <ul className="no-scrollbar phone-gutter mx-auto flex max-w-[var(--shell)] items-center gap-2 overflow-x-auto py-0.5 md:px-0 lg:justify-center">
        {CHANNELS.map((channel) => (
          <li key={channel.label} className="shrink-0">
            <Link
              href={channel.href}
              className={`group flex items-center gap-2 rounded-full py-2 pl-2.5 pr-4 text-[12px] font-semibold ring-1 ring-shop-edge transition-colors hover:ring-shop-primary md:text-[12px] ${channel.tint}`}
            >
              {channel.icon}
              <span className="whitespace-nowrap">{channel.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
