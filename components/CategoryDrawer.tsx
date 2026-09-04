"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CategoryNode } from "@/lib/woocommerce";

/**
 * The categories drawer — the whole shop, as a slide-in panel, below `lg`.
 *
 * ---- What this replaced, and why ----
 *
 * A full-width dropdown that fell out of the header and laid the department
 * tree out in a multi-column grid. On a desktop that is the right shape and
 * {@link CategoriesMenu} still serves it. On a phone the same markup collapsed
 * to one narrow column of headings with six or eight children stacked under
 * each, inside a box capped at 75vh — so the first department filled the
 * viewport, everything else was below the fold of a scroll inside a scroll, and
 * the panel read as a page that had failed to lay out rather than as a menu.
 *
 * A phone menu is a drawer. It comes from the edge, it owns the screen while it
 * is open, and it is a single column of touch targets — which is what every
 * marketplace on this market serves, and what shoppers here already know how to
 * drive.
 *
 * ---- The shape of it ----
 *
 * Three bands, each with a heading of its own:
 *
 *   1. ACCOUNT — orders, reviews, wishlist. First because a shopper opening
 *      the menu on a shop they have used before is usually going back to
 *      something, not browsing forward.
 *   2. OUR CATEGORIES — the department tree, one row each, with a glyph.
 *   3. OUR SERVICES — the things that are not shopping: selling, stores,
 *      tracking, help.
 *
 * The band headings are small, uppercase and grey, with an orange "See all" on
 * the right where there is somewhere for it to go. They are not decoration:
 * without them a drawer is forty undifferentiated rows and a shopper scrolls
 * past the thing they wanted because nothing told them the list had changed
 * subject.
 *
 * ---- Rows navigate; chevrons expand ----
 *
 * A department row is a link to that department. Where a department has
 * children, a separate chevron button beside it opens them inline rather than
 * navigating — so the tree is still fully browsable from the drawer, which is
 * what the old grid panel was buying and what a single-level list would have
 * quietly thrown away.
 *
 * Splitting the two into separate controls is deliberate. A row that both
 * navigates and expands depending on where the thumb lands is the interaction
 * everyone has mis-tapped at least once.
 */
export default function CategoryDrawer({
  departments,
  open,
  onClose,
}: {
  departments: CategoryNode[];
  open: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  // Closing also collapses whatever department was open, so the drawer reopens
  // at the top of the tree rather than in the middle of whichever one was last
  // poked at. Done here rather than in an effect watching `open`: a setState in
  // an effect body is a second render every time the drawer shuts, to change
  // something nobody can see while it is shut.
  const close = useCallback(() => {
    setExpanded(null);
    onClose();
  }, [onClose]);

  // Escape closes, and the page behind the drawer stops scrolling — the same
  // contract `CartDrawer` keeps, because two panels on one site that treat the
  // background differently is a bug the shopper feels without being able to
  // name it.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    // Mounted at all times so the transition plays in both directions — a
    // drawer that only animates open and then vanishes reads as a crash.
    // `pointer-events-none` while closed keeps the invisible scrim from
    // swallowing taps on the page behind it.
    <div className={`fixed inset-0 z-[95] lg:hidden ${open ? "" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Close menu"
        onClick={close}
        className={`absolute inset-0 cursor-default bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        // 86% rather than the full width, and capped at 360px. The sliver of
        // dimmed page down the right edge is what says "this is a layer over
        // the shop" instead of "the shop has navigated somewhere" — and it is
        // the target a shopper flicks at to dismiss without hunting for an X.
        className={`absolute bottom-0 left-0 top-0 flex w-[86%] max-w-[360px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Categories and account"
      >
        {/* ---- The one coloured surface in the drawer ----
            Everything below is white with hairlines, so the account strip is
            the only thing wearing the brand. That is enough to anchor the top
            of the panel without turning a navigation list into a poster. */}
        <div className="flex shrink-0 items-center gap-3 bg-shop-primary px-4 py-4 text-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" />
            </svg>
          </span>
          <Link href="/account" onClick={close} className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-tight">My account</span>
            <span className="block truncate text-[12px] leading-tight text-white/80">
              Orders, wishlist and settings
            </span>
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* One scroll for the whole tree. The old panel scrolled inside a box
            that was itself on a scrolling page, which is the arrangement where
            a thumb-flick lands in whichever of the two the browser feels like. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Band title="Your account">
            <Row href="/account/orders" onClose={close} icon={<IconBox />} label="My orders" />
            <Row href="/account/reviews" onClose={close} icon={<IconStar />} label="Pending reviews" />
            <Row href="/account/wishlist" onClose={close} icon={<IconHeart />} label="Wishlist" />
          </Band>

          <Band title="Our categories" seeAll="/categories" onClose={close}>
            {departments.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-shop-muted">
                No departments yet — add product categories in WordPress and they
                appear here.
              </p>
            ) : (
              departments.map((department) => (
                <div key={department.id}>
                  <div className="flex items-center">
                    <Row
                      href={`/category/${department.slug}`}
                      onClose={close}
                      icon={<CategoryGlyph name={department.name} />}
                      label={department.name}
                    />

                    {department.children.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((current) =>
                            current === department.id ? null : department.id
                          )
                        }
                        aria-expanded={expanded === department.id}
                        aria-label={`Show ${department.name} subcategories`}
                        // A 44px square, which is the smallest thing a thumb
                        // hits reliably — and it has to be, because it sits
                        // directly beside a link that goes somewhere else.
                        className="flex h-11 w-11 shrink-0 items-center justify-center text-shop-muted transition-colors hover:text-shop-primary"
                      >
                        <svg
                          className={`h-4 w-4 transition-transform duration-200 ${
                            expanded === department.id ? "rotate-90" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {expanded === department.id && (
                    // Indented to clear the parent's glyph, on the shop's
                    // lightest surface — so an open department reads as a
                    // drawer within the drawer rather than as more top-level
                    // rows that happen to be spelled differently.
                    <ul className="bg-shop-surface py-1">
                      {department.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={`/category/${child.slug}`}
                            onClick={close}
                            className="block truncate py-2.5 pl-[54px] pr-4 text-[14px] text-shop-body transition-colors hover:text-shop-primary"
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </Band>

          <Band title="Our services">
            <Row href="/sale" onClose={close} icon={<IconTag />} label="Today's deals" />
            <Row href="/sellers" onClose={close} icon={<IconStore />} label="Shop by store" />
            <Row href="/track-order" onClose={close} icon={<IconTruck />} label="Track my order" />
            <Row href="/help" onClose={close} icon={<IconHelp />} label="Help centre" />
            <Row href="/sell" onClose={close} icon={<IconSell />} label="Sell on KandiUg" />
          </Band>

          {/* The list has to end on something other than a cut-off row, and on
              a phone the last 24px of a scroll container sit under the gesture
              bar on most handsets. */}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}

/**
 * One titled band of rows.
 *
 * The heading is 11.5px uppercase at a wide track — small enough that it never
 * competes with the rows it labels, spaced enough that it still reads as a
 * label rather than as shrunken body text. The rule above it is what separates
 * bands; the rows inside carry none, because forty hairlines down a drawer is a
 * ledger, not a menu.
 */
function Band({
  title,
  seeAll,
  onClose,
  children,
}: {
  title: string;
  seeAll?: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-shop-line first:border-t-0">
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-shop-muted">
          {title}
        </h2>
        {seeAll && (
          <Link
            href={seeAll}
            onClick={onClose}
            className="shrink-0 text-[12px] font-bold text-shop-primary"
          >
            See all
          </Link>
        )}
      </div>
      <div className="pb-2">{children}</div>
    </section>
  );
}

/**
 * One navigable row: glyph, label, and nothing else.
 *
 * `flex-1` and `min-w-0` so a long department name truncates instead of pushing
 * the chevron beside it off the panel. 48px tall at this padding, which clears
 * the 44px floor a thumb needs.
 */
function Row({
  href,
  label,
  icon,
  onClose,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3 text-[14px] text-shop-ink transition-colors hover:text-shop-primary"
    >
      <span className="shrink-0 text-shop-body">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

/* ---- The glyphs ----
 *
 * Line icons at 22px, drawn to one spec: no fill, 1.6 stroke, round joins. They
 * are keyed off the department NAME rather than passed in, because the tree
 * comes from WooCommerce and a shop that adds a department in WordPress should
 * get a sensible row without anyone touching this file.
 *
 * Matching is on substrings and covers the names this catalogue actually uses
 * plus the obvious synonyms. Anything unmatched gets the tag, which is a real
 * icon rather than a blank — a row with a hole where its glyph should be is the
 * one thing that makes a list like this look broken.
 */
const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  className: "h-[22px] w-[22px]",
  "aria-hidden": true,
};

function IconBox() {
  return (
    <svg {...common}>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9ZM3.5 7.5 12 12m0 0 8.5-4.5M12 12v9" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg {...common}>
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg {...common}>
      <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg {...common}>
      <path d="M3.5 12.5 11 5h8v8l-7.5 7.5a1.5 1.5 0 0 1-2.1 0l-5.9-5.9a1.5 1.5 0 0 1 0-2.1ZM15.5 9h.01" />
    </svg>
  );
}

function IconStore() {
  return (
    <svg {...common}>
      <path d="M4 9.5V20h16V9.5M3 9.5 4.8 4h14.4L21 9.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM10 20v-5h4v5" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg {...common}>
      <path d="M3 6.5h10v10H3zM13 10h4l3 3v3.5h-7M7 20a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 20ZM17.5 20a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.6A2.3 2.3 0 0 1 14.3 10c0 1.6-2.3 2-2.3 3.4M12 17h.01" />
    </svg>
  );
}

function IconSell() {
  return (
    <svg {...common}>
      <path d="M4 20v-6.5M9.3 20V9M14.7 20v-7.5M20 20V4" />
    </svg>
  );
}

/** Department glyphs, chosen by what the department is called. */
function CategoryGlyph({ name }: { name: string }) {
  const key = name.toLowerCase();
  const has = (...words: string[]) => words.some((word) => key.includes(word));

  if (has("phone", "mobile", "tablet")) {
    return (
      <svg {...common}>
        <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" />
        <path d="M10.5 5.5h3M12 18.5h.01" />
      </svg>
    );
  }

  if (has("comput", "laptop", "office")) {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="11" rx="1.6" />
        <path d="M2 19.5h20" />
      </svg>
    );
  }

  if (has("electronic", "tv", "audio", "appliance")) {
    return (
      <svg {...common}>
        <rect x="3" y="7.5" width="18" height="12" rx="1.8" />
        <path d="m8 3.5 4 4 4-4M17 15.5h.01" />
      </svg>
    );
  }

  if (has("home", "furnit", "kitchen", "living")) {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    );
  }

  if (has("health", "beauty", "cosmet", "care")) {
    return (
      <svg {...common}>
        <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
        <path d="M4.5 13h4l1.5-3 2 6 1.5-3h6" />
      </svg>
    );
  }

  if (has("supermarket", "grocer", "food", "drink")) {
    return (
      <svg {...common}>
        <path d="M15.5 8.5a3.5 3.5 0 0 0-7 0c0 6-2.5 6.5-2.5 9a3.5 3.5 0 0 0 3.5 3.5h5A3.5 3.5 0 0 0 18 17.5c0-2.5-2.5-3-2.5-9ZM12 5V2.5" />
      </svg>
    );
  }

  if (has("sport", "fitness", "gym", "outdoor")) {
    return (
      <svg {...common}>
        <path d="M3 9.5v5M6 7.5v9M18 7.5v9M21 9.5v5M6 12h12" />
      </svg>
    );
  }

  if (has("gam", "toy", "console")) {
    return (
      <svg {...common}>
        <path d="M8 9.5H6.2A3.2 3.2 0 0 0 3 12.7v2.1A3.2 3.2 0 0 0 6.2 18h11.6A3.2 3.2 0 0 0 21 14.8v-2.1a3.2 3.2 0 0 0-3.2-3.2H16" />
        <path d="M7 12v3M5.5 13.5h3M16 13h.01M18 15h.01" />
      </svg>
    );
  }

  if (has("garden", "plant", "farm")) {
    return (
      <svg {...common}>
        <path d="M12 21v-7M12 14c0-4 2.5-7 7-7 0 4-2.5 7-7 7ZM12 16c0-3-2-5.5-5.5-5.5 0 3 2 5.5 5.5 5.5Z" />
      </svg>
    );
  }

  if (has("shoe", "footwear", "sneaker", "boot")) {
    return (
      <svg {...common}>
        <path d="M3 16.5V9h3l2 2.5 4 1.5 4 1.5h4.5a1.5 1.5 0 0 1 0 3H3Z" />
      </svg>
    );
  }

  if (has("bag", "luggage", "handbag")) {
    return (
      <svg {...common}>
        <path d="M4.5 8h15l-1 12.5h-13Z" />
        <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" />
      </svg>
    );
  }

  if (has("watch", "jewel", "accessor")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M9 7.8 9.5 3h5l.5 4.8M9 16.2l.5 4.8h5l.5-4.8" />
      </svg>
    );
  }

  if (has("baby", "kid", "child")) {
    return (
      <svg {...common}>
        <circle cx="7" cy="6.5" r="2.6" />
        <circle cx="17" cy="6.5" r="2.6" />
        <circle cx="12" cy="14" r="6.5" />
        <path d="M10 13h.01M14 13h.01M10.5 16.5a2.4 2.4 0 0 0 3 0" />
      </svg>
    );
  }

  if (has("women", "ladies", "dress")) {
    return (
      <svg {...common}>
        <path d="M9 3h6l-1.4 3.2 1 2.4L13 12l4.6 6.4A1 1 0 0 1 16.8 20H7.2a1 1 0 0 1-.8-1.6L11 12 9.4 8.6l1-2.4Z" />
      </svg>
    );
  }

  // Men, fashion, clothing and anything else garment-shaped: the shirt.
  if (has("men", "fashion", "cloth", "wear", "apparel")) {
    return (
      <svg {...common}>
        <path d="M9 3 12 6l3-3 4.5 2.2a1 1 0 0 1 .5 1.1L19.2 11H17v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9H4.8L4 6.3a1 1 0 0 1 .5-1.1Z" />
      </svg>
    );
  }

  return <IconTag />;
}
