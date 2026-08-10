import { quoteDelivery, type LatLng } from "@/lib/delivery";
import { describeLocation, locateAddress, mapsEnabled } from "@/lib/geocode";
import { getDeliveryRates } from "@/lib/site-settings";

/**
 * Prices one delivery.
 *
 * The rates live on the server, never in the browser bundle. The checkout sends
 * a location and gets back a figure — it cannot send a figure. The same
 * function runs again when the order is placed, so a tampered request pays the
 * real fee or none.
 *
 * Accepts either coordinates (from the browser's Geolocation API) or a typed
 * address, which is geocoded first.
 */

type QuoteBody = {
  point?: LatLng;
  address?: string;
  subtotal?: number;
};

export async function POST(request: Request) {
  let body: QuoteBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subtotal = Math.max(0, Number(body.subtotal) || 0);

  let point: LatLng | null = null;

  if (
    body.point &&
    Number.isFinite(body.point.lat) &&
    Number.isFinite(body.point.lng) &&
    Math.abs(body.point.lat) <= 90 &&
    Math.abs(body.point.lng) <= 180
  ) {
    point = { lat: body.point.lat, lng: body.point.lng };
  } else if (body.address?.trim()) {
    point = await locateAddress(body.address.trim());
  }

  if (!point) {
    return Response.json(
      { error: "We could not find that place. Try a nearby landmark or suburb." },
      { status: 422 }
    );
  }

  const rates = await getDeliveryRates();
  const quote = quoteDelivery(point, subtotal, rates);

  // The address is cosmetic — the price came from the coordinates — so a
  // geocoder that is slow or down must not fail the quote.
  const details = await describeLocation(point).catch(() => ({
    label: null,
    street: "",
    city: "",
  }));

  return Response.json({
    ...quote,
    place: details.label,
    // The street and town, for the checkout to type into its own fields.
    address: { street: details.street, city: details.city },
    point,
    mapsEnabled: mapsEnabled(),
    freeDeliveryFrom: rates.freeDeliveryFrom,
  });
}
