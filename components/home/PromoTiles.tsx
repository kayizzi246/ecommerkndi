import Link from "next/link";

/**
 * The row of small promotional tiles under the category chips.
 *
 * Five short entry points instead of one tall hero. A hero spends a screen on a
 * single message; this spends a fraction of one on five, and every tile is a
 * real destination in the shop rather than a slogan.
 *
 * Tiles drop out as the window narrows — three on a phone, four on a tablet,
 * five on a desktop — so the row is always exactly one line and never wraps
 * into a ragged block.
 *
 * Each tile is a link, not a decorative div: they are navigation, and they have
 * to be reachable by keyboard and readable by a screen reader.
 */
const TILES: {
  /** The reason to click, in as few words as fit on one line. */
  title: string;
  copy: string;
  href: string;
  className: string;
  /** Which breakpoint this tile survives down to. */
  visibility?: string;
}[] = [
  // Every tile leads on the number or the promise, not on the department name:
  // "Up to 80% OFF" is a reason to click, "Super Deals" is a label for one. The
  // second line carries the thing that removes the risk — a deadline, a price
  // floor, pay on delivery — because in this market hesitation, not interest,
  // is what loses the sale.
  {
    title: "Up to 80% OFF",
    copy: "Super Deals — lowest prices",
    href: "/sale",
    className: "bg-gradient-to-br from-shop-primary to-shop-ember text-white",
  },
  {
    title: "Flash Sale",
    copy: "Ends tonight at midnight",
    href: "/sale",
    className: "bg-shop-sale text-white",
  },
  {
    title: "Just Landed",
    copy: "New styles every week",
    href: "/search?sort=newest",
    className: "bg-shop-ink text-white",
  },
  {
    title: "Best Sellers",
    copy: "What Uganda is buying",
    href: "/search?sort=popular",
    className: "bg-shop-success text-white",
    visibility: "hidden md:flex",
  },
  {
    title: "Pay on Delivery",
    copy: "Check it, then pay",
    href: "/help",
    className: "border border-shop-line bg-white text-shop-ink",
    visibility: "hidden lg:flex",
  },
];

export default function PromoTiles() {
  return (
    <nav aria-label="Promotions">
      <ul className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5">
        {TILES.map((tile) => (
          <li key={tile.title} className={tile.visibility}>
            <Link
              href={tile.href}
              className={`flex h-full flex-col items-center justify-center rounded-lg px-3 py-4 text-center transition-transform duration-150 hover:-translate-y-0.5 hover:opacity-95 ${tile.className}`}
            >
              <span className="font-heading text-[15px] font-bold leading-tight md:text-[16px]">
                {tile.title}
              </span>
              <span className="mt-0.5 text-[12px] opacity-90">{tile.copy}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
