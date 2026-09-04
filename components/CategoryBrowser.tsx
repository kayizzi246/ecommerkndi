"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

/**
 * One tile in the right-hand pane: a shelf, drawn as a picture and a name.
 *
 * `image` is allowed to be empty. A WooCommerce category has no image until
 * somebody uploads one, and on this catalogue most of them never will — so the
 * server falls back to a photograph of something filed under that shelf, and
 * the tile falls back again to a plain initial when even that is missing. A
 * tile with a broken frame is worse than a tile with no frame.
 */
export type BrowseTile = {
  name: string;
  slug: string;
  image: string;
};

export type BrowseDepartment = {
  id: number;
  name: string;
  slug: string;
  tiles: BrowseTile[];
};

/**
 * The phone's categories screen: a rail of departments down the left, the
 * shelves of the selected one as pictures on the right.
 *
 * ---- Why the page needed a second shape at all ----
 *
 * `/categories` is a stack of department rails — a heading, shelf tabs and a
 * row of products, repeated once per department. On a laptop that is a page of
 * merchandise. On a 390px screen it is one department per screenful, so a
 * shopper looking for Shoes on a shop with six departments scrolls past four
 * rails of things they did not ask for to reach the name of the thing they
 * did. The rails sell to somebody browsing; this screen is for somebody
 * *navigating*, which is what a shopper who tapped the Categories tab is
 * almost always doing.
 *
 * The two-pane browser is what every marketplace on this market serves for the
 * same job, and the reason is mechanical rather than fashionable: the whole
 * department list stays on screen while the shelves change beside it, so the
 * shopper never loses the place they are choosing from. A stack of rails
 * cannot do that at any height.
 *
 * So the rails stay from `md` up, where there is width for them, and this
 * takes the phone. Same data, both fed from the same server render — see
 * `app/categories/page.tsx`.
 *
 * ---- The tree is still crawlable ----
 *
 * The department rail is buttons, and buttons are invisible to a crawler. That
 * costs this page nothing, because every slug it can reach is also a real `<a>`
 * in the shelf index at the foot of the page, which renders at every width.
 * The tiles themselves are links, so the shelves are reachable both ways.
 */
export default function CategoryBrowser({
  departments,
  grids,
}: {
  departments: BrowseDepartment[];
  /**
   * One product grid per department, by index, server-rendered.
   *
   * `ProductCard` is a server component and this file is not, so the tiles
   * cannot be built here — they arrive as nodes. An entry is `null` where the
   * department's feed came back empty, which is the same case the rail
   * deliberately still lists.
   */
  grids: ReactNode[];
}) {
  const [active, setActive] = useState(0);
  const current = departments[active] ?? departments[0];
  const grid = grids[active] ?? null;

  if (!current) return null;

  return (
    /* The two panes scroll as one page rather than as two independent
       scrollers. A pane with its own scrollbar has to be given a height, and
       the only honest height on a phone is the viewport minus a sticky header
       that hides on scroll and a fixed bottom bar with a safe-area inset under
       it — three numbers that are wrong on some device the moment they are
       written down. The rail is sticky instead: it holds its place while the
       tiles beside it scroll, which is the behaviour that was actually wanted,
       and it costs no arithmetic. */
    <div className="flex items-start border-t border-shop-line md:hidden">
      {/* ---- The department rail ----
          104px is about a quarter of a 390px screen, which is the narrowest a
          long department name ("Cell Phones & Accessories") stays readable at
          13px. Wider starts taking the third tile column away from the pane it
          exists to serve. */}
      <nav
        aria-label="Departments"
        className="no-scrollbar sticky top-0 max-h-[100dvh] w-[104px] shrink-0 overflow-y-auto overscroll-contain border-r border-shop-line bg-[#f7f7f7]"
      >
        <ul>
          {departments.map((department, index) => {
            const on = index === active;
            return (
              <li key={department.id}>
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-current={on ? "true" : undefined}
                  /* The selected department is white — the same colour as the
                     pane beside it — so the two read as one surface with a
                     notch cut out of the rail, rather than as a highlighted row
                     in a list. That is the whole trick of this layout, and it
                     is why the rail is tinted and the pane is not. */
                  className={`relative block w-full px-3 py-3.5 text-left text-[13px] leading-[17px] transition-colors ${
                    on
                      ? "bg-white font-bold text-shop-primary"
                      : "font-medium text-shop-body active:bg-black/[0.03]"
                  }`}
                >
                  {on && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-shop-primary"
                    />
                  )}
                  {department.name}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ---- The pane ----
          `min-w-0` is load-bearing: without it a long shelf name in the grid
          sets the flex item's minimum width and pushes the whole browser wider
          than the phone, which shows up as a sideways scroll on the page rather
          than as anything visibly wrong with this block. */}
      <div className="min-w-0 flex-1 px-3 pb-8 pt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="truncate text-[17px] font-extrabold text-shop-ink">
            {current.name}
          </h2>
          <Link
            href={`/category/${current.slug}`}
            className="shrink-0 text-[12px] font-bold text-shop-primary"
          >
            Shop all
          </Link>
        </div>

        {current.tiles.length === 0 ? (
          <p className="py-6 text-[13px] text-shop-muted">
            Nothing filed under {current.name} yet.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-x-2 gap-y-4">
            {current.tiles.map((tile) => (
              <li key={tile.slug}>
                <Link href={`/category/${tile.slug}`} className="block">
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-shop-photo">
                    {tile.image ? (
                      <Image
                        src={tile.image}
                        alt=""
                        fill
                        /* Three columns of a phone, and this block is gone by
                           768px: (100vw − the 104px rail − gutters) / 3 rounds
                           to about 30vw. Asking for more is downloading a
                           picture twice the size of its frame on the connection
                           least able to afford it. */
                        sizes="30vw"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[20px] font-black text-shop-line">
                        {tile.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <span className="mt-1.5 line-clamp-2 block text-center text-[12px] font-medium leading-[15px] text-shop-body">
                    {tile.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* ---- The goods, under the shelves ----

            The tiles above answer "what is filed here"; this answers "is any
            of it worth my time", which is the question the shelf names cannot
            and the reason a browse screen of pure navigation always felt like
            a table of contents.

            The grid is pulled out to the pane's edges — `-mx-3` against the
            `px-3` on the pane — because `.product-grid-flush` tiles butt up
            against each other and a photograph that stops 12px short of the
            screen reads as a card that has been inset by mistake. The rail
            still holds the left side, so this is edge-to-edge for the pane
            rather than for the page. */}
        {grid && (
          <div className="mt-6">
            <h3 className="mb-2 text-[14px] font-bold text-shop-ink">
              Popular in {current.name}
            </h3>
            <div className="-mx-3">{grid}</div>
            <Link
              href={`/category/${current.slug}`}
              className="mt-4 flex items-center justify-center rounded-full border border-shop-line py-2.5 text-[13px] font-bold text-shop-body"
            >
              See all {current.name}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
