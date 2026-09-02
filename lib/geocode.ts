import type { LatLng } from "@/lib/delivery";

/**
 * Turning coordinates into a place name, and a place name into coordinates.
 *
 * Two providers behind one interface. Which one runs depends only on whether
 * `GOOGLE_MAPS_API_KEY` is set, so adding a key later is a deployment change
 * rather than a code change — and the delivery pricing never has to know which
 * answered.
 *
 *   • No key  → OpenStreetMap's Nominatim. Free, no account, no billing. Its
 *     usage policy requires an identifying User-Agent and rate-limits to about
 *     one request a second, which is why this is only ever called once per
 *     checkout, server-side, and never in a loop.
 *
 *   • With a key → Google Geocoding, which is better on Ugandan street
 *     addresses and returns a tidier label.
 *
 * Both are best-effort: a failure returns null and the checkout falls back to
 * the coordinates alone. The *price* comes from the coordinates, so a missing
 * label never blocks an order.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org";
const GOOGLE = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * Administrative names tidied into what a person would write on a form.
 *
 * OpenStreetMap returns the *district*, so a shopper in Kampala gets back
 * "Kampala Capital City" — correct, and not what anyone puts in a City box.
 * Only the suffix is stripped, so "Wakiso District" becomes "Wakiso" while
 * genuine names are left untouched.
 */
function tidyCityName(city: string): string {
  return city
    .replace(/\s+(Capital City( Authority)?|District|Municipality|Division|Sub-?county)$/i, "")
    .trim();
}

function googleKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY ?? "";
}

/** True when a visual map and address autocomplete are available. */
export function mapsEnabled(): boolean {
  return googleKey().length > 0;
}

/**
 * A reverse-geocoded location, split the way a checkout form is.
 *
 * `label` is for showing back to the shopper; `street` and `city` fill the
 * address fields, so sharing a location types the form for them.
 *
 * Every part is optional. Reverse geocoding in Uganda routinely returns a
 * suburb and nothing else — outside the larger towns, most roads are simply not
 * in the data — so the fields are pre-filled where possible and left for the
 * shopper to complete where not.
 */
export type PlaceDetails = {
  label: string | null;
  street: string;
  city: string;
};

/** A short, human place name for a set of coordinates. */
export async function describePlace(point: LatLng): Promise<string | null> {
  return (await describeLocation(point)).label;
}

/** Coordinates turned into form-shaped address parts. */
export async function describeLocation(point: LatLng): Promise<PlaceDetails> {
  const empty: PlaceDetails = { label: null, street: "", city: "" };
  const key = googleKey();

  try {
    if (key) {
      const response = await fetch(
        `${GOOGLE}?latlng=${point.lat},${point.lng}&key=${key}&result_type=street_address|neighborhood|locality`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as {
        results?: {
          formatted_address?: string;
          address_components?: { long_name: string; types: string[] }[];
        }[];
      };

      const result = data.results?.[0];
      if (!result) return empty;

      const part = (type: string) =>
        result.address_components?.find((c) => c.types.includes(type))?.long_name ?? "";

      // House number and road are separate components in Google's response and
      // have to be recombined; `route` alone reads as a road with no address on
      // it, which is not what the courier needs.
      const street = [part("street_number"), part("route")].filter(Boolean).join(" ");

      return {
        label: result.formatted_address ?? null,
        street: street || part("neighborhood") || part("sublocality"),
        // `locality` is the town. Kampala's suburbs come back as
        // administrative_area_level_2 or _1 when the town itself is missing.
        city:
          part("locality") ||
          part("postal_town") ||
          part("administrative_area_level_2") ||
          part("administrative_area_level_1"),
      };
    }

    const response = await fetch(
      `${NOMINATIM}/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&zoom=18`,
      {
        // Nominatim's policy requires identifying the application. A request
        // without this is liable to be blocked.
        headers: { "User-Agent": "KandiUg-Storefront/1.0 (support@kandiug.com)" },
        cache: "no-store",
      }
    );

    const data = (await response.json()) as {
      name?: string;
      address?: Record<string, string>;
      display_name?: string;
    };

    const address = data.address ?? {};

    // Nominatim's naming varies by what is mapped locally, so each field is a
    // list of candidates from most to least specific rather than one key.
    const suburb =
      address.suburb ?? address.neighbourhood ?? address.residential ?? address.quarter ?? "";
    const city =
      address.city ?? address.town ?? address.municipality ?? address.village ?? address.county ?? "";

    const street = [
      [address.house_number, address.road].filter(Boolean).join(" "),
      // The named building or business at the point, when there is one — often
      // the most useful thing a rider can be told.
      data.name && data.name !== address.road ? data.name : "",
      suburb,
    ]
      .filter(Boolean)
      // De-duplicated: Nominatim frequently repeats the suburb as the name.
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(", ");

    const locality = suburb || city;

    return {
      // The full display_name runs to seven comma-separated parts including the
      // country and postcode, which is not a place name anybody recognises.
      label: [data.name, locality].filter(Boolean).join(", ") || locality || null,
      street,
      city: tidyCityName(city || suburb),
    };
  } catch (error) {
    console.error("[kandi-store] reverse geocode failed:", error);
    return empty;
  }
}

/** One place a shopper might mean, for the checkout's suggestion list. */
export type PlaceSuggestion = {
  /** What the shopper reads: "Ntinda, Kampala". */
  label: string;
  point: LatLng;
};

/**
 * Places matching what has been typed so far — the checkout's autocomplete.
 *
 * Distinct from `locateAddress` in the one way that matters: it returns
 * SEVERAL candidates instead of silently taking the first. "Kira" is a road in
 * Kampala and a town in Wakiso twenty kilometres away, and those are different
 * delivery fees; picking one on the shopper's behalf and charging for it is the
 * failure this exists to prevent.
 *
 * Both providers are biased to Uganda and capped at five. Five is what fits
 * under a field on a phone without covering the next one, and past three the
 * list stops being read anyway.
 *
 * Errors return an empty list rather than throwing. A suggestion box that
 * cannot suggest is an inconvenience; the shopper can still type the area and
 * press the button, which is the path that existed before this.
 */
export async function suggestPlaces(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const key = googleKey();
  const scoped = /uganda/i.test(trimmed) ? trimmed : `${trimmed}, Uganda`;

  try {
    if (key) {
      const response = await fetch(
        `${GOOGLE}?address=${encodeURIComponent(scoped)}&key=${key}&region=ug`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as {
        results?: {
          formatted_address?: string;
          geometry?: { location?: { lat: number; lng: number } };
        }[];
      };

      return (data.results ?? [])
        .slice(0, 5)
        .map((result) => ({
          label: tidyLabel(result.formatted_address ?? ""),
          point: {
            lat: result.geometry?.location?.lat ?? 0,
            lng: result.geometry?.location?.lng ?? 0,
          },
        }))
        .filter((entry) => entry.label !== "" && entry.point.lat !== 0);
    }

    const response = await fetch(
      `${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=ug&q=${encodeURIComponent(scoped)}`,
      {
        headers: { "User-Agent": "KandiUg-Storefront/1.0 (support@kandiug.com)" },
        cache: "no-store",
      }
    );

    const data = (await response.json()) as
      | { lat?: string; lon?: string; display_name?: string }[]
      | null;

    return (data ?? [])
      .map((entry) => ({
        label: tidyLabel(entry.display_name ?? ""),
        point: { lat: Number(entry.lat ?? 0), lng: Number(entry.lon ?? 0) },
      }))
      .filter((entry) => entry.label !== "" && Number.isFinite(entry.point.lat) && entry.point.lat !== 0)
      .slice(0, 5);
  } catch (error) {
    console.error("[kandi-store] place search failed:", error);
    return [];
  }
}

/**
 * Trims a geocoder's full label down to something a person would say.
 *
 * Nominatim returns the entire administrative chain — "Ntinda, Nakawa Division,
 * Kampala, Central Region, 256, Uganda" — which is six commas of noise around
 * the two words the shopper recognises. The first three parts, minus the
 * country and any postcode, is the address as it would be spoken.
 */
function tidyLabel(raw: string): string {
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part !== "" &&
        !/^uganda$/i.test(part) &&
        !/^\d+$/.test(part) &&
        !/region$/i.test(part)
    );

  return parts.slice(0, 3).join(", ");
}

/** Coordinates for a typed address. Used by the manual-entry fallback. */
export async function locateAddress(query: string): Promise<LatLng | null> {
  const key = googleKey();
  // Biased to Uganda so "Ntinda" finds the Kampala suburb rather than a
  // similarly-named place on another continent.
  const scoped = /uganda/i.test(query) ? query : `${query}, Uganda`;

  try {
    if (key) {
      const response = await fetch(
        `${GOOGLE}?address=${encodeURIComponent(scoped)}&key=${key}&region=ug`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as {
        results?: { geometry?: { location?: { lat: number; lng: number } } }[];
      };
      const location = data.results?.[0]?.geometry?.location;
      return location ? { lat: location.lat, lng: location.lng } : null;
    }

    const response = await fetch(
      `${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=ug&q=${encodeURIComponent(scoped)}`,
      {
        headers: { "User-Agent": "KandiUg-Storefront/1.0 (support@kandiug.com)" },
        cache: "no-store",
      }
    );

    const data = (await response.json()) as { lat?: string; lon?: string }[];
    const first = data[0];
    if (!first?.lat || !first?.lon) return null;

    return { lat: Number(first.lat), lng: Number(first.lon) };
  } catch (error) {
    console.error("[kandi-store] forward geocode failed:", error);
    return null;
  }
}
