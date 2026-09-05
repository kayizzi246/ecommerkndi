"use client";

import { useEffect, useState } from "react";
import {
  BACKORDER_WINDOW,
  formatDeliveryDayShort,
  nextDeliveryDate,
} from "@/lib/delivery-eta";

/**
 * "Get it Wed 10 Sep" on a grid tile.
 *
 * ---- Why a date earns a row on a tile this tight ----
 *
 * Every other row on this card answers *what it is* and *what it costs*. None
 * of them answer the question a shopper actually stalls on, which is *when do
 * I get it* — and on a marketplace where some sellers take a week, that
 * uncertainty is what sends people to the shop they have used before. The
 * strip on the product page has always answered it; a shopper had to open a
 * product to find out.
 *
 * It is the same answer on most tiles, and that is not an argument against it.
 * A next-day promise repeated down a grid is the shop's strongest single
 * claim, and it is the one claim here that is about the shop rather than about
 * the product — which is exactly the sort of thing that has to be said more
 * than once to be believed.
 *
 * ---- It does differentiate where it matters ----
 *
 * `onbackorder` is a real stock state in this catalogue and it is not next
 * day: those tiles say so instead. That is the whole point of putting this on
 * the card rather than printing one banner over the grid — the promise is per
 * product, and the tiles that cannot keep it are the tiles a shopper most
 * needs to know about before they get attached.
 *
 * Out of stock renders nothing. The card already carries a "Sold out" pill and
 * a "Back in stock soon" line, and a delivery date on something that cannot be
 * bought is noise at best.
 *
 * ---- The row holds its height before the date arrives ----
 *
 * The date is the viewer's clock, so it cannot be computed during a server
 * render: these pages are statically generated and revalidated, and a date
 * baked in at build time is wrong by the next morning. It is filled in after
 * mount, like the product page's strip.
 *
 * Which means for one frame there is no text — and a row that appears on
 * hydration would push every tile in the grid down at once, a few hundred
 * milliseconds after the page looks finished. The wrapper is a fixed height
 * whether it has text in it or not, so the space is paid for in the first
 * paint and nothing moves.
 */
export default function TileDeliveryEta({
  stockStatus,
}: {
  stockStatus: "instock" | "outofstock" | "onbackorder";
}) {
  const [day, setDay] = useState<string | null>(null);

  // The clock is client-only, so it is read after mount rather than during
  // render — that is what keeps the server and client markup identical. The
  // single update on mount is the point of the effect, hence the waiver.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(formatDeliveryDayShort(nextDeliveryDate()));
  }, []);

  if (stockStatus === "outofstock") return null;

  const backorder = stockStatus === "onbackorder";

  return (
    /* ---- The date is emphasised, not coloured ----

       This was set in `shop-save` green, on the argument that an arrival date
       is good news in the same way a saving is. In place it was wrong twice
       over: the tile already carries a green "Save UGX N" chip two rows above,
       so the card grew a second green saying something else — and green in
       this palette means money coming back, which a delivery date is not.
       Diluting it costs the saving chip its meaning.

       Weight instead of hue, which is also what every marketplace worth
       copying does with this line: the label stays quiet in `body`, the DATE
       is near-black and semibold, and the eye lands on the only part a shopper
       is reading for. That leaves the tile at one accent per fact — red for
       the price, green for the saving, orange for scarcity. */
    <p className="flex h-[16px] items-center gap-1 overflow-hidden text-[11px] font-medium leading-[14px] text-shop-body">
      <svg
        aria-hidden
        className="h-3 w-3 shrink-0 text-shop-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h10v9H3V7Zm10 3h4l3 3v3h-7v-6Z" />
        <circle cx="7" cy="18" r="1.4" />
        <circle cx="17" cy="18" r="1.4" />
      </svg>
      {/* `truncate` on the text and not on the row: the icon must never be the
          thing that gets cut. */}
      <span className="truncate">
        {backorder ? (
          BACKORDER_WINDOW
        ) : day ? (
          <>
            Get it <span className="font-semibold text-shop-ink">{day}</span>
          </>
        ) : (
          " "
        )}
      </span>
    </p>
  );
}
