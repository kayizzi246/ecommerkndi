import { quoteDelivery, type LatLng } from "@/lib/delivery";
import { describeLocation, locateAddress, mapsEnabled } from "@/lib/geocode";
import { getDeliveryRates } from "@/lib/site-settings";
import { APP_WRITE_CORS_HEADERS, appPreflight } from "@/lib/app-api";

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

async function quote(request: Request): Promise<Response> {
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

/**
 * ---- The exported handlers ----
 *
 * The work is `quote` above; these two exist so that the delivery quote can be called
 * from a browser-hosted build of the app.
 *
 * `OPTIONS` answers the preflight the browser sends before any cross-origin
 * POST carrying `Content-Type: application/json`, and `POST` copies the same
 * permission onto the real answer — a preflight that passes and a response with
 * no `Access-Control-Allow-Origin` on it still fails, and fails looking exactly
 * like a network error. The reasoning behind opening these up at all is on
 * `APP_WRITE_CORS_HEADERS`.
 *
 * The headers are added to a COPY of the response rather than being threaded
 * through every `return` inside — there are a dozen of them and one forgotten
 * on an error path is a bug nobody sees until an order fails.
 */
export function OPTIONS(): Response {
  return appPreflight();
}

export async function POST(request: Request): Promise<Response> {
  const response = await quote(request);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(APP_WRITE_CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
