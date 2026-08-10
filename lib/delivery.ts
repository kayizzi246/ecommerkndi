/**
 * Delivery pricing.
 *
 * Per-kilometre from the shop's own location: a base fee that covers the rider
 * turning up at all, plus a rate for every kilometre after a short free radius,
 * capped so a delivery to the far side of the country cannot quote a number
 * nobody would pay.
 *
 * Every figure is editable in wp-admin. The defaults below are plausible Kampala
 * rates, not researched ones — they exist so the shop works out of the box, and
 * they should be replaced with what your riders actually cost.
 *
 * Deliberately pure and free of network calls: the same function runs on the
 * server to price an order and in the browser to preview it, and the two must
 * never disagree.
 */

export type LatLng = { lat: number; lng: number };

export type DeliveryRates = {
  /** Where deliveries start from. Defaults to central Kampala. */
  origin: LatLng;
  /** Charged on every delivery, regardless of distance. */
  baseFee: number;
  /** Charged per kilometre beyond `freeRadiusKm`. */
  perKm: number;
  /** Distance included in the base fee. */
  freeRadiusKm: number;
  /** The fee never exceeds this, however far away the address is. */
  maxFee: number;
  /** Beyond this the shop does not deliver at all. 0 disables the limit. */
  maxDistanceKm: number;
  /** Order subtotal at or above which delivery is free. 0 disables it. */
  freeDeliveryFrom: number;
};

export const DEFAULT_RATES: DeliveryRates = {
  // Kampala city centre.
  origin: { lat: 0.3476, lng: 32.5825 },
  baseFee: 3000,
  perKm: 700,
  freeRadiusKm: 3,
  maxFee: 30000,
  maxDistanceKm: 120,
  freeDeliveryFrom: 150000,
};

/**
 * Great-circle distance in kilometres.
 *
 * Straight-line rather than road distance, which is what a routing API would
 * give and what a key would cost money for. For pricing it is the right trade:
 * it under-reads real road distance by a fairly consistent factor in a city, so
 * the `perKm` rate absorbs it — and it can never fail, rate-limit or bill you.
 */
export function distanceKm(from: LatLng, to: LatLng): number {
  const R = 6371; // Earth's mean radius, km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

export type DeliveryQuote = {
  /** Kilometres from the shop, rounded to one decimal. */
  km: number;
  /** What the shopper pays. 0 when the order qualifies for free delivery. */
  fee: number;
  /** True when the fee was waived by the order value, not by distance. */
  free: boolean;
  /** False when the address is outside the delivery radius. */
  deliverable: boolean;
  /** A short human label — "Within Kampala", "18 km from Kampala". */
  label: string;
};

/** Prices one delivery. */
export function quoteDelivery(
  destination: LatLng,
  subtotal: number,
  rates: DeliveryRates = DEFAULT_RATES
): DeliveryQuote {
  const km = Math.round(distanceKm(rates.origin, destination) * 10) / 10;

  if (rates.maxDistanceKm > 0 && km > rates.maxDistanceKm) {
    return {
      km,
      fee: 0,
      free: false,
      deliverable: false,
      label: `${km} km away — outside our delivery area`,
    };
  }

  // The order value waives the fee before distance is even priced, so a big
  // order to a far address is still free rather than "free, but…".
  if (rates.freeDeliveryFrom > 0 && subtotal >= rates.freeDeliveryFrom) {
    return { km, fee: 0, free: true, deliverable: true, label: labelFor(km) };
  }

  const chargeableKm = Math.max(0, km - rates.freeRadiusKm);
  const raw = rates.baseFee + chargeableKm * rates.perKm;

  // Rounded to the nearest 500 shillings: riders are paid in cash and nobody
  // carries change for a 4,237 shilling delivery.
  const rounded = Math.round(Math.min(raw, rates.maxFee) / 500) * 500;

  return { km, fee: rounded, free: false, deliverable: true, label: labelFor(km) };
}

function labelFor(km: number): string {
  if (km <= 3) return "Within central Kampala";
  if (km <= 15) return `${km} km — greater Kampala`;
  return `${km} km from Kampala`;
}

/**
 * How much more the shopper must spend to stop paying for delivery.
 * Returns 0 when they already qualify or when the offer is switched off.
 */
export function amountToFreeDelivery(subtotal: number, rates: DeliveryRates): number {
  if (rates.freeDeliveryFrom <= 0) return 0;
  return Math.max(0, rates.freeDeliveryFrom - subtotal);
}
