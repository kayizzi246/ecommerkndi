import { distanceKm, type LatLng } from "@/lib/delivery";

/**
 * Where cash on delivery is offered, and nowhere else.
 *
 * ---- Why this exists ----
 *
 * Cash on delivery is the only payment method on this shop where the money and
 * the goods change hands at the door: the rider carries the stock out, and
 * whether the shop is paid at all depends on somebody being home, having the
 * cash, and still wanting the parcel. Every one of those can fail, and when it
 * does the shop has paid for a round trip and holds a used-looking box.
 *
 * That risk is not spread evenly. The shop's own experience is that it is
 * bearable in the three neighbourhoods below and not bearable outside them, so
 * COD is offered there and the rest of the country pays before the rider
 * leaves. This is a commercial decision, not a technical one — the code's job
 * is only to make it hold.
 *
 * ---- Why a coordinate and a radius, not the typed address ----
 *
 * The checkout asks for a city and a street, and a shopper can type anything
 * into either. "Kololo" in the city box is a claim; a point inside a 1.8km
 * circle around Kololo is a fact the shop can price a rider against, and it is
 * the same point delivery is already quoted from — see `quoteDelivery`. Reading
 * the zone off the coordinate means the answer cannot be typed around, and it
 * cannot drift from the fee.
 *
 * Circles rather than polygons deliberately. A suburb boundary in Kampala is
 * not a line anybody agrees on, and a rider does not think in polygons either;
 * a centre and a radius is the shape this decision actually has, it is one
 * number to argue about per area, and it needs no map data at all.
 *
 * ---- The numbers ----
 *
 * Centres are the recognised middle of each neighbourhood and the radii are
 * drawn to cover it without reaching into the next one — Nakasero and Kololo
 * are close enough that generous circles would merge and quietly enrol the
 * valley between them. They are approximations, and they are meant to be
 * edited: if a rider reports that a street on the edge should be in or out,
 * this list is the one place to change it.
 */
export type CodZone = {
  /** As it should be printed for a shopper. */
  name: string;
  centre: LatLng;
  radiusKm: number;
};

export const COD_ZONES: CodZone[] = [
  { name: "Kololo", centre: { lat: 0.3336, lng: 32.5947 }, radiusKm: 1.8 },
  { name: "Nakasero", centre: { lat: 0.322, lng: 32.58 }, radiusKm: 1.5 },
  { name: "Muyenga", centre: { lat: 0.2939, lng: 32.6118 }, radiusKm: 2 },
];

/**
 * The zone a point falls in, or null.
 *
 * The nearest matching zone wins rather than the first, so overlapping circles
 * name the neighbourhood the address is actually closest to — which is what a
 * shopper reading "Cash on delivery is available in Kololo" expects to see.
 */
export function codZoneFor(point: LatLng | null | undefined): CodZone | null {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return null;
  }

  let best: { zone: CodZone; km: number } | null = null;

  for (const zone of COD_ZONES) {
    const km = distanceKm(zone.centre, point);
    if (km <= zone.radiusKm && (!best || km < best.km)) {
      best = { zone, km };
    }
  }

  return best?.zone ?? null;
}

/** Whether cash on delivery can be offered for this location at all. */
export function codAvailableAt(point: LatLng | null | undefined): boolean {
  return codZoneFor(point) !== null;
}

