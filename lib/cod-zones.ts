import { DEFAULT_RATES, distanceKm, type LatLng } from "@/lib/delivery";

/** Every location within 40 km of central Kampala qualifies for cash on delivery.
 * Shared by checkout and its API. Check unrounded straight-line distance.
 */
export type CodZone = { name: string; centre: LatLng; radiusKm: number };
export const COD_RADIUS_KM = 40;
export const COD_ZONES: CodZone[] = [
  { name: "Within 40 km of central Kampala", centre: DEFAULT_RATES.origin, radiusKm: COD_RADIUS_KM },
];

export function codZoneFor(point: LatLng | null | undefined): CodZone | null {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return null;
  return COD_ZONES.find((zone) => distanceKm(zone.centre, point) <= zone.radiusKm) ?? null;
}

export function codAvailableAt(point: LatLng | null | undefined): boolean {
  return codZoneFor(point) !== null;
}
