/**
 * When a shopper gets it.
 *
 * ---- Why this is a module and not two lines in each component ----
 *
 * The promise is now made in two places: the strip on the product page
 * (`DeliveryPromise`) and the line on every grid tile (`TileDeliveryEta`).
 * Those are the two screens a shopper compares — they open a tile, read a
 * date, tap through and read it again — and a shop that answers "when" with
 * two different days on one visit has not made a promise, it has made a
 * doubt.
 *
 * The date was already being computed inline in `DeliveryPromise`. Copying
 * those three lines into the tile is how the two would have drifted the first
 * time either was touched, so it is one function that both call.
 *
 * ---- The clock is read on the CLIENT, deliberately ----
 *
 * Nothing here may run during a server render. These pages are statically
 * generated and revalidated, so a date baked in at build time is a date that
 * is wrong by the next morning — "get it tomorrow" rendered on Monday and
 * served on Thursday. Both callers compute in an effect after mount, which
 * also keeps the server and client markup identical.
 */

/** Cut-off for same-day dispatch, in the shop's own wording. */
export const ORDER_BEFORE = "12 AM";

/** The hour the courier's day ends, in the shop's own wording. */
export const ARRIVES_BY = "10:00 PM";

/**
 * The day an in-stock order placed now should arrive.
 *
 * Next day, which is the promise the product page has always made and the one
 * the riders work to. It is deliberately not clever about weekends: the shop
 * delivers seven days a week, and a rule that skipped Sunday here would make
 * this function disagree with the strip it was extracted from — which is the
 * one failure it exists to prevent. If the delivery week ever changes, it
 * changes here and both callers follow.
 */
export function nextDeliveryDate(from: Date = new Date()): Date {
  const day = new Date(from);
  day.setDate(day.getDate() + 1);
  return day;
}

/** "Wednesday 10 Sep" — the long form, for the product page's strip. */
export function formatDeliveryDayLong(day: Date): string {
  return day.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/**
 * "Wed 10 Sep" — the short form, for a tile.
 *
 * A grid cell is about 150px wide on a phone and the line has to survive
 * beside an icon without wrapping, so the weekday is abbreviated. It is still
 * a weekday and a date rather than the word "tomorrow": "tomorrow" is read as
 * marketing, and a named day is read as a commitment.
 */
export function formatDeliveryDayShort(day: Date): string {
  return day.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * How long a backordered line takes, in the shop's own wording.
 *
 * WooCommerce's `onbackorder` means the seller will accept the order and
 * source the item, which is not next-day and must not be sold as if it were.
 * A range rather than a date, because the shop does not know the day and a
 * precise-looking answer it cannot keep is worse than an honest window.
 */
export const BACKORDER_WINDOW = "Ships in 3–5 days";
